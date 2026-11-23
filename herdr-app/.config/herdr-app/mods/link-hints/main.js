import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { checking, closeOverlay, focused, hc, nextCommand, notify, panes, props, run, setShared, settings, shared, terminals, theme } from "herdr";

const ALPHABET = "sadfjklewcmpgh";
const URL = /https?:\/\/[^\s<>"'`]+/g;
const POPUP = "link-hints.popup";
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

// Grid origins measured from `herdr-app shot` with one pane in the tab. Mods
// can't read where a pane sits in the window, so splits fall back to a list.
const ORIGINS = { workbench: { x: 473.5, y: 90 } };
// Mods can't read the display scale either; a Retina display is assumed.
const SCALE = 2;

// Ghostty rounds cells to whole device pixels; JetBrains Mono's advance is
// 0.6em and its ascent plus descent 1.32em.
function geometry(layoutName) {
  const s = settings();
  const px = Number(s.font_size ?? 14) * Number(s.zoom ?? 1) * SCALE;
  return {
    ...(ORIGINS[layoutName] ?? { x: 0, y: 0 }),
    w: Math.round(px * 0.6) * Number(s.terminal_cell_width ?? 1) / SCALE,
    h: Math.round(px * 1.32) * Number(s.terminal_line_height ?? 1) / SCALE,
  };
}

function keyName({ key, key_char, modifiers }) {
  if (modifiers.control || modifiers.platform || modifiers.alt) return null;
  return key_char && key_char.length === 1 && key.length === 1 ? key_char.toLowerCase() : key;
}

export default class LinkHints extends View {
  init(_props, cx) {
    this.typed = "";
    if (checking()) {
      // A check has no overlay; draw sample hints so it covers the drawing path.
      this.handle = cx.focus_handle();
      this.layoutName = "check";
      this.grid = { cols: 80, rows: 24 };
      this.hints = [
        { url: "https://example.com", label: "a", spans: [{ row: 1, start: 2, end: 21 }] },
        { url: "https://example.org", label: "sd", spans: [{ row: 3, start: 70, end: 80 }, { row: 4, start: 0, end: 9 }] },
      ];
      return;
    }
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
    this.hints = null;
    this.layoutName = String(shared("layout") ?? "main");
    this.list = !this.placeable();
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      let error;
      try {
        error = await this.load();
      } catch (e) {
        error = `Link hints failed: ${e?.message ?? e}`;
      }
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
        if (command.startsWith("key-")) this.press(command.slice(4), false, cx);
        else if (command === "escape" || command === "backspace") this.press(command, false, cx);
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
      const screenRows = findLinks(text ?? "", cols).rows;
      const full = await hc(["read", this.terminal, "--json", "--lines", String(back)]);
      if (full.code !== 0) return full.stderr.trim() || "Couldn't read the history";
      text = JSON.parse(full.stdout).text;
      top = findLinks(text ?? "", cols).rows - screenRows - back;
    }
    let links = findLinks(text ?? "", cols).links
      .map((l) => ({ ...l, spans: l.spans.map((s) => ({ ...s, row: s.row - top })).filter((s) => s.row >= 0 && s.row < height) }))
      .filter((l) => l.spans.length);
    if (this.list) {
      const seen = new Set();
      links = links.filter((l) => !seen.has(l.url) && seen.add(l.url));
    }
    const names = labels(links.length);
    this.hints = links.map((l, i) => ({ ...l, label: names[i] }));
    this.grid = { cols, rows: height };
    return null;
  }

  // Mods can't read where a pane sits, so inline markers are trusted only
  // where the origin was measured: a pane filling its tab, at zoom 1.
  // Anywhere else the same labels show as a list.
  placeable() {
    const pane = panes().find((p) => p.pane === this.pane);
    const lone = pane?.zoomed || panes().filter((p) => p.tab === pane?.tab).length === 1;
    return Boolean(lone && ORIGINS[this.layoutName] && Number(settings().zoom ?? 1) === 1);
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
    cx.notify();
  }

  activate(url, copy, cx) {
    this.finish();
    if (copy) {
      cx.write_to_clipboard(url);
      notify({ title: "Copied link", body: url, level: "success", timeout: 1500 });
    } else {
      cx.open_url(url);
    }
  }

  finish(refocus = true) {
    if (this.done) return;
    this.done = true;
    closeOverlay(this.overlay);
    if (refocus && panes().some((p) => p.pane === this.pane)) run("pane.focus", { pane: this.pane });
  }

  async close() {
    this.finish();
  }

  // Where the popup sits in the window. Herdr insets it from the `at` corner,
  // so the first pointer move over it measures that inset and keeps it.
  popup() {
    return shared(POPUP) ?? { x: 8.6, y: 10.6 };
  }

  measure(event) {
    if (!event.local_position) return;
    const at = { x: event.position.x - event.local_position.x, y: event.position.y - event.local_position.y };
    const was = this.popup();
    if (Math.abs(at.x - was.x) > 0.25 || Math.abs(at.y - was.y) > 0.25) setShared(POPUP, at);
  }

  render() {
    // A popup takes the width share from mod.json but not the height, so the
    // root sizes itself to what the window shows from the popup's corner on.
    const view = window.viewport_size();
    const p = this.popup();
    const root = div().id("link-hints").w(view.width - p.x).h(view.height - p.y).relative();
    if (!this.handle) return root;
    // Switching tab or pane leaves the hints behind; let the new focus be.
    const now = focused();
    if (this.pane && !this.done && now?.pane !== this.pane) {
      this.finish(false);
      return root;
    }
    const c = geometry(this.layoutName);
    const x = (col) => c.x - p.x + col * c.w;
    const y = (row) => c.y - p.y + row * c.h;
    const t = theme();
    const font = String(settings().font ?? "JetBrains Mono");
    const grid = this.grid;
    const shown = (this.hints ?? []).filter((h) => h.label.startsWith(this.typed));

    // Labels take the terminal palette's blue (green while ⇧ copies), with the
    // terminal background as ink, so they follow light and dark themes.
    const solid = (this.copying ? t.ansi2 : t.ansi4) ?? t.accent;
    const ink = t.background;
    const alpha = (color, a) => (/^#[0-9a-f]{6}$/i.test(color) ? color + a : color);
    const letters = (h) => [
      this.typed && div().text_color(alpha(ink, "80")).child(this.typed.toUpperCase()),
      div().child(h.label.slice(this.typed.length).toUpperCase()),
    ].filter(Boolean);
    const badge = (h) => h_flex()
      .flex_none()
      .items_center()
      .justify_center()
      .rounded(4)
      .bg(solid)
      .text_color(ink)
      .font_family(font)
      .font_weight(800)
      .whitespace_nowrap()
      .children(letters(h));

    if (this.list) {
      const width = Math.min(640, view.width - 48);
      const row = (h) => {
        const rest = h.url.replace(/^https?:\/\//, "");
        const cut = rest.search(/[/?#]/);
        const host = cut === -1 ? rest : rest.slice(0, cut);
        return h_flex().id(`row-${h.label}`).h(34).flex_none().px(10).gap(12).items_center()
          .child(badge(h).h(22).min_w(22).px(5).text_size(12))
          .child(div().flex_none().text_color(t.foreground).font_weight(500).child(host))
          .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(cut === -1 ? "" : rest.slice(cut)));
      };
      return root
        .track_focus(this.handle)
        .on_key_down((event, cx) => {
          cx.stop_propagation();
          const key = keyName(event);
          if (key) this.press(key, event.modifiers.shift, cx);
        })
        .on_modifiers_changed((event, cx) => this.modifiers(event, cx))
        .on_mouse_down("left", () => this.finish())
        .when(shown.length > 0, (el) => el.child(
          v_flex().id("link-hints-list").absolute().left((view.width - width) / 2 - p.x).top(72 - p.y).w(width)
            .bg(t.popover).border_1().border_color(t.border).rounded(12).shadow_lg().overflow_hidden()
            .text_size(13).font_family(font)
            .child(v_flex().p(6).gap(2).children(shown.slice(0, 14).map(row))),
        ));
    }

    // Everything but the links fades back: a veil of the terminal's own
    // background over every cell that isn't part of a shown URL.
    const veil = grid ? Array.from({ length: grid.rows }, (_, r) => {
      const spans = shown.flatMap((h) => h.spans.filter((s) => s.row === r)).sort((a, b) => a.start - b.start);
      const gaps = [];
      let at = 0;
      for (const s of [...spans, { start: grid.cols, end: grid.cols }]) {
        if (s.start > at) gaps.push([at, s.start]);
        at = Math.max(at, s.end);
      }
      return gaps.map(([from, to]) => div().id(`veil-${r}-${from}`).absolute()
        .left(x(from)).top(y(r)).w((to - from) * c.w).h(c.h).bg(alpha(t.background, "a8")));
    }).flat() : [];

    // The label ends just left of the URL, over the dimmed text before it,
    // so the whole address stays readable.
    const marker = (h) => {
      const first = h.spans[0];
      return badge(h).id(`hint-${h.label}`).absolute()
        .right(view.width - p.x - x(first.start) + 2).top(y(first.row) + 1)
        .min_w(Math.max(h.label.length, 1.6) * c.w).h(c.h - 2).px(3)
        .shadow_sm()
        .text_size(Math.max(10, Math.round(c.h * 0.64)));
    };

    return root
      .track_focus(this.handle)
      .on_key_down((event, cx) => {
        cx.stop_propagation();
        const key = keyName(event);
        if (key) this.press(key, event.modifiers.shift, cx);
      })
      .on_modifiers_changed((event, cx) => this.modifiers(event, cx))
      .on_mouse_move((event) => this.measure(event))
      .on_mouse_down("left", () => this.finish())
      .when(shown.length > 0, (el) => el.children(veil))
      .children(shown.map(marker));
  }

  modifiers(event, cx) {
    const m = event.modifiers;
    const copying = Boolean(m.shift && !m.platform && !m.control && !m.alt);
    if (copying !== Boolean(this.copying)) {
      this.copying = copying;
      cx.notify();
    }
  }
}
