import { View, div } from "gpui-kit";
import { checking, closeOverlay, focused, hc, layout, nextCommand, notify, panes, props, run, setShared, terminals } from "herdr";

const ALPHABET = "sadfjklewcmpgh";
const URL = /https?:\/\/[^\s<>"'`]+/g;
// What each pane-header copy reads to draw the labels under its header (pane-header/hints.js).
const HINTS = "link-hints.shown";
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
// over the grid to find the cells each URL covers, one span per row.
function findLinks(text, cols) {
  const links = [];
  let row = -1;
  for (const line of text.split("\n")) {
    const cells = new Map();
    let col = 0;
    let index = 0;
    row++;
    for (const ch of line) {
      const w = cellWidth(ch);
      if (col + w > cols) {
        row++;
        col = 0;
      }
      cells.set(index, { row, col, w });
      col += w;
      index += ch.length;
    }
    for (const m of line.matchAll(URL)) {
      const url = trimUrl(m[0]);
      const spans = [];
      for (let i = m.index; i < m.index + url.length; i++) {
        const cell = cells.get(i);
        if (!cell) continue;
        const span = spans.at(-1);
        if (span?.row === cell.row) span.end = cell.col + cell.w;
        else spans.push({ row: cell.row, start: cell.col, end: cell.col + cell.w });
      }
      if (spans.length) links.push({ url, spans });
    }
  }
  return { rows: row + 1, links };
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

// The labels are drawn by the pane-header mod, pinned under a header at the top of each pane.
function framed(node) {
  if (!node || typeof node !== "object") return false;
  const header = node.content?.pane?.header;
  if (header?.content?.mod === "pane-header" && (header.position ?? "top") === "top" && header.reveal !== "hover") return true;
  return [...(node.children ?? []), ...(node.floating ?? [])].some(framed);
}

function keyName({ key, key_char, modifiers }) {
  if (modifiers.control || modifiers.platform || modifiers.alt) return null;
  return key_char && key_char.length === 1 && key.length === 1 ? key_char.toLowerCase() : key;
}

export default class LinkHints extends View {
  init(_props, cx) {
    this.typed = "";
    if (checking()) {
      this.handle = cx.focus_handle();
      return;
    }
    this.overlay = props()?.overlay;
    if (!this.overlay) return;
    const { terminal, pane, shown } = focused() ?? {};
    if (!terminal || !pane || shown || !terminals().some((t) => t.address === terminal && t.state === "live")) {
      notify({ title: "link hints need a focused terminal pane", level: "info", timeout: 2000 });
      closeOverlay(this.overlay);
      return;
    }
    if (!framed(layout())) {
      notify({ title: "link hints need pane-header", body: "this layout's panes need the pane-header mod as a header at the top, always shown.", level: "info", timeout: 2500 });
      closeOverlay(this.overlay);
      return;
    }
    this.terminal = terminal;
    this.pane = pane;
    this.hints = null;
    this.at = Date.now();
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      let error;
      try {
        error = await this.load();
      } catch (e) {
        error = `link hints failed: ${e?.message ?? e}`;
      }
      if (this.done) return;
      if (error || !this.hints.length) {
        notify({ title: error ?? "no links on screen", level: error ? "error" : "info", timeout: 2000 });
        this.finish();
        return;
      }
      this.publish();
    });
    cx.spawn(async (cx) => {
      while (!this.done) {
        const command = await nextCommand();
        if (this.done) return;
        if (command.startsWith("key-")) this.press(command.slice(4), false, cx);
        else if (command === "escape" || command === "backspace") this.press(command, false, cx);
      }
    });
  }

  async load() {
    const terminal = terminals().find((t) => t.address === this.terminal);
    const cols = terminal?.cols;
    const height = terminal?.rows;
    if (!cols || !height) return "couldn't size the terminal";
    const scroll = panes().find((p) => p.pane === this.pane)?.scroll;
    const back = scroll?.from_bottom ?? 0;
    const screen = await hc(["read", this.terminal, "--json"]);
    if (screen.code !== 0) return screen.stderr.trim() || "couldn't read the terminal";
    let { text } = JSON.parse(screen.stdout);
    let top = 0;
    if (back > 0) {
      // The screen read is top-aligned; history rows sit above it, so the
      // viewport starts `back` rows above where the screen's own rows begin.
      const screenRows = findLinks(text ?? "", cols).rows;
      const full = await hc(["read", this.terminal, "--json", "--lines", String(back)]);
      if (full.code !== 0) return full.stderr.trim() || "couldn't read the history";
      text = JSON.parse(full.stdout).text;
      top = findLinks(text ?? "", cols).rows - screenRows - back;
    }
    const links = findLinks(text ?? "", cols).links
      .map((l) => ({ ...l, spans: l.spans.map((s) => ({ ...s, row: s.row - top })).filter((s) => s.row >= 0 && s.row < height) }))
      .filter((l) => l.spans.length);
    const names = labels(links.length);
    this.hints = links.map((l, i) => ({ ...l, label: names[i] }));
    this.grid = { cols, rows: height };
    return null;
  }

  publish() {
    if (this.done || !this.hints) return;
    setShared(HINTS, {
      pane: this.pane,
      at: this.at,
      grid: this.grid,
      hints: this.hints.map(({ label, spans }) => ({ label, spans })),
      typed: this.typed,
      copying: Boolean(this.copying),
    });
  }

  press(key, shift, cx) {
    if (this.done) return;
    if (key === "escape") return this.finish();
    if (key === "backspace") this.typed = this.typed.slice(0, -1);
    else if (key.length === 1 && ALPHABET.includes(key) && this.hints) {
      const typed = this.typed + key;
      const matches = this.hints.filter((h) => h.label.startsWith(typed));
      if (!matches.length) return;
      this.typed = typed;
      const hit = matches.find((h) => h.label === typed);
      if (hit) return this.activate(hit.url, shift, cx);
    } else return;
    this.publish();
  }

  activate(url, copy, cx) {
    this.finish();
    if (copy) {
      cx.write_to_clipboard(url);
      notify({ title: "copied link", body: url, level: "success", timeout: 1500 });
    } else {
      cx.open_url(url);
    }
  }

  finish(refocus = true) {
    if (this.done) return;
    this.done = true;
    setShared(HINTS, null);
    closeOverlay(this.overlay);
    if (refocus && panes().some((p) => p.pane === this.pane)) run("pane.focus", { pane: this.pane });
  }

  async close() {
    this.finish();
  }

  // Draws nothing: it holds the keyboard and takes a click anywhere as a cancel.
  render() {
    const view = window.viewport_size();
    const root = div().id("link-hints").w(view.width).h(view.height);
    if (!this.handle) return root;
    // Switching tab or pane leaves the hints behind; let the new focus be.
    if (this.pane && !this.done && focused()?.pane !== this.pane) {
      this.finish(false);
      return root;
    }
    return root
      .track_focus(this.handle)
      .on_key_down((event, cx) => {
        cx.stop_propagation();
        const key = keyName(event);
        if (key) this.press(key, event.modifiers.shift, cx);
      })
      .on_modifiers_changed((event, cx) => this.modifiers(event, cx))
      .on_mouse_down("left", () => this.finish());
  }

  modifiers(event) {
    const m = event.modifiers;
    const copying = Boolean(m.shift && !m.platform && !m.control && !m.alt);
    if (copying !== Boolean(this.copying)) {
      this.copying = copying;
      this.publish();
    }
  }
}
