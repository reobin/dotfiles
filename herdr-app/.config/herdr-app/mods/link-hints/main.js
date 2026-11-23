import { View, div } from "gpui-kit";
import { closeOverlay, exec, focused, hc, nextCommand, notify, panes, props, run, setShared, settings, shared, terminals } from "herdr";

const ALPHABET = "sadfjklewcmpgh";
const URL = /https?:\/\/[^\s<>"'`]+/g;
const CALIBRATION = "link-hints.calibration";
const emoji = /^\p{Emoji_Presentation}$/u;
const mark = /^\p{Mark}$/u;

function trimUrl(url) {
  let u = url.replace(/[.,;:!?*]+$/, "");
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (u.endsWith(close) && u.split(open).length < u.split(close).length) u = u.slice(0, -1);
  }
  return u.replace(/[.,;:!?*]+$/, "");
}

function cellWidth(ch) {
  const n = ch.codePointAt(0);
  if (mark.test(ch) || ch === "‍" || ch === "️") return 0;
  return emoji.test(ch) || (n >= 0x1100 && (
    n <= 0x115f || (n >= 0x2e80 && n <= 0xa4cf && n !== 0x303f) ||
    (n >= 0xac00 && n <= 0xd7a3) || (n >= 0xf900 && n <= 0xfaff) ||
    (n >= 0xfe30 && n <= 0xfe6f) || (n >= 0xff01 && n <= 0xff60) ||
    (n >= 0xffe0 && n <= 0xffe6) || (n >= 0x20000 && n <= 0x3fffd)
  )) ? 2 : 1;
}

// `hc read` joins soft-wrapped rows into one line, so a line is laid back out
// over the grid to find each URL's starting row and column.
function physicalRows(text, cols) {
  const links = [];
  let row = -1;
  for (const line of text.split("\n")) {
    const starts = new Map();
    let col = 0;
    let index = 0;
    row++;
    for (const ch of line) {
      const w = cellWidth(ch);
      if (col + w > cols) {
        row++;
        col = 0;
      }
      starts.set(index, { row, col });
      col += w;
      index += ch.length;
    }
    for (const m of line.matchAll(URL)) {
      const at = starts.get(m.index);
      if (at) links.push({ url: trimUrl(m[0]), ...at });
    }
  }
  return { count: row + 1, links };
}

// Vimium's labels: breadth-first over the alphabet, so no label prefixes another.
function labels(n) {
  const hints = [""];
  let offset = 0;
  while (hints.length - offset < n || hints.length === 1) {
    const hint = hints[offset++];
    for (const ch of ALPHABET) hints.push(ch + hint);
  }
  return hints.slice(offset, offset + n).sort().map((h) => [...h].reverse().join(""));
}

// Grid origins measured from `herdr-app shot` with one pane in the tab. Mods
// can't read where a pane sits in the window, so splits need re-calibrating.
const ORIGINS = { workbench: { x: 473.5, y: 90 } };
// Mods can't read the display scale either; a Retina display is assumed.
const SCALE = 2;

// Ghostty rounds cells to whole device pixels; JetBrains Mono's advance is
// 0.6em and its ascent plus descent 1.32em.
function defaultCalibration(layoutName) {
  const s = settings();
  const px = Number(s.font_size ?? 14) * Number(s.zoom ?? 1) * SCALE;
  return {
    ...(ORIGINS[layoutName] ?? { x: 0, y: 0 }),
    w: Math.round(px * 0.6) * Number(s.terminal_cell_width ?? 1) / SCALE,
    h: Math.round(px * 1.32) * Number(s.terminal_line_height ?? 1) / SCALE,
  };
}

function keyName({ key, key_char, modifiers }) {
  if (modifiers.control || modifiers.platform) return null;
  if (modifiers.alt) return `alt-${key}`;
  if (modifiers.shift && key.length > 1) return `shift-${key}`;
  return key_char && key_char.length === 1 && key.length === 1 ? key_char.toLowerCase() : key;
}

export default class LinkHints extends View {
  init(_props, cx) {
    this.overlay = props()?.overlay;
    if (!this.overlay) return;
    const { terminal, pane, shown } = focused() ?? {};
    if (!terminal || !pane || shown || !terminals().some((t) => t.address === terminal && t.state === "live")) {
      notify({ title: "Link hints need a focused terminal pane", level: "info", timeout: 2000 });
      closeOverlay(this.overlay);
      return;
    }
    this.terminal = terminal;
    this.pane = pane;
    this.typed = "";
    this.hints = null;
    this.layoutName = String(shared("layout") ?? "main");
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      const error = await this.load();
      if (this.done) return;
      if (error || !this.hints.length) {
        notify({ title: error ?? "No links on screen", level: error ? "error" : "info", timeout: 2000 });
        this.finish();
        return;
      }
      cx.notify();
    });
    cx.spawn(async (cx) => {
      while (!this.done) {
        const command = await nextCommand();
        if (this.done) return;
        if (command.startsWith("key-")) this.press(command.slice(4), cx);
        else if (command === "escape" || command === "backspace") this.press(command, cx);
      }
    });
  }

  async load() {
    const terminal = terminals().find((t) => t.address === this.terminal);
    const cols = terminal?.cols;
    const height = terminal?.rows;
    if (!cols || !height) return "Couldn't size the terminal";
    const scroll = panes().find((p) => p.pane === this.pane)?.scroll;
    const back = scroll?.from_bottom ?? 0;
    const screen = await hc(["read", this.terminal, "--json"]);
    if (screen.code !== 0) return screen.stderr.trim() || "Couldn't read the terminal";
    let { text } = JSON.parse(screen.stdout);
    let top = 0;
    if (back > 0) {
      // The screen read is top-aligned; history rows sit above it, so the
      // viewport starts `back` rows above where the screen's own rows begin.
      const screenRows = physicalRows(text ?? "", cols).count;
      const full = await hc(["read", this.terminal, "--json", "--lines", String(back)]);
      if (full.code !== 0) return full.stderr.trim() || "Couldn't read the history";
      text = JSON.parse(full.stdout).text;
      top = physicalRows(text ?? "", cols).count - screenRows - back;
    }
    const links = physicalRows(text ?? "", cols).links
      .map((l) => ({ ...l, row: l.row - top }))
      .filter((l) => l.row >= 0 && l.row < height);
    const names = labels(links.length);
    this.hints = links.map((l, i) => ({ ...l, label: names[i] }));
    this.grid = { cols, rows: height };
    return null;
  }

  calibration() {
    const saved = shared(CALIBRATION)?.[this.layoutName];
    return saved ?? defaultCalibration(this.layoutName);
  }

  nudge(change) {
    const all = { ...(shared(CALIBRATION) ?? {}) };
    const c = { ...this.calibration() };
    for (const [k, v] of Object.entries(change)) c[k] = Math.round((c[k] + v) * 100) / 100;
    all[this.layoutName] = c;
    this.calibrating = true;
    setShared(CALIBRATION, all);
  }

  press(key, cx) {
    if (this.done) return;
    const step = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    if (key === "escape") return this.finish();
    if (key === "backspace") this.typed = this.typed.slice(0, -1);
    else if (step[key]) this.nudge({ x: step[key][0], y: step[key][1] });
    else if (key.startsWith("shift-") && step[key.slice(6)]) {
      const [dx, dy] = step[key.slice(6)];
      this.nudge({ x: dx * 10, y: dy * 10 });
    } else if (key.startsWith("alt-") && step[key.slice(4)]) {
      const [dx, dy] = step[key.slice(4)];
      this.nudge({ w: dx * 0.05, h: dy * 0.05 });
    } else if (key === "?") this.calibrating = !this.calibrating;
    else if (key.length === 1 && ALPHABET.includes(key) && this.hints) {
      const typed = this.typed + key;
      const matches = this.hints.filter((h) => h.label.startsWith(typed));
      if (!matches.length) return;
      this.typed = typed;
      const hit = matches.find((h) => h.label === typed);
      if (hit) return this.open(hit.url);
    } else return;
    cx.notify();
  }

  open(url) {
    this.finish();
    notify({ title: "Opening link", body: url, level: "info", timeout: 1500 });
    exec("open", [url]);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    closeOverlay(this.overlay);
    if (panes().some((p) => p.pane === this.pane)) run("pane.focus", { pane: this.pane });
  }

  async close() {
    this.finish();
  }

  render() {
    const root = div().id("link-hints").size_full().relative();
    if (!this.handle) return root;
    const c = this.calibration();
    const size = Math.max(9, Math.round(c.h * 0.62));
    const font = String(settings().font ?? "JetBrains Mono");
    const badge = (h) => {
      const rest = h.label.slice(this.typed.length);
      return div()
        .id(`hint-${h.label}`)
        .absolute()
        .left(c.x + h.col * c.w)
        .top(c.y + h.row * c.h)
        .h(c.h)
        .px(3)
        .flex()
        .items_center()
        .rounded(3)
        .bg("#f8d66d")
        .border_1()
        .border_color("#b3851d")
        .shadow_sm()
        .font_family(font)
        .text_size(size)
        .font_weight(700)
        .text_color("#302205")
        .whitespace_nowrap()
        .when(this.typed.length > 0, (el) => el.child(div().text_color("#a88a3a").child(this.typed)))
        .child(rest.toUpperCase());
    };
    const grid = this.grid;
    const status = this.hints ? `${this.hints.length} links` : "reading";
    const area = this.size ? `${Math.round(this.size.width)}×${Math.round(this.size.height)}` : "unsized";
    return root
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .child(
        div().absolute().left(c.x).top(Math.max(0, c.y - 30)).px(6).py(2).rounded(4)
          .bg("#302205").text_color("#f8d66d").text_size(12).font_family(font)
          .child(`link hints · ${status} · overlay ${area}`),
      )
      .track_focus(this.handle)
      .on_key_down((event, cx) => {
        cx.stop_propagation();
        const key = keyName(event);
        if (key) this.press(key, cx);
      })
      .on_mouse_down("left", () => this.finish())
      .when(this.calibrating && grid, (el) => el.child(
        div().absolute().left(c.x).top(c.y).w(grid.cols * c.w).h(grid.rows * c.h)
          .border_1().border_color("#f8d66d"),
      ).child(
        div().absolute().left(c.x + 4).top(c.y + grid.rows * c.h - 26).px(6).py(2).rounded(4)
          .bg("#302205").text_color("#f8d66d").text_size(12).font_family(font)
          .child(`${this.layoutName} x ${c.x} y ${c.y} cell ${c.w}×${c.h} grid ${grid.cols}×${grid.rows}`),
      ))
      .children((this.hints ?? []).filter((h) => h.label.startsWith(this.typed)).map(badge));
  }
}
