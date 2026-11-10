import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { spaces, panes, agents, terminals, focused, theme, settings, props, closeOverlay, shared, setShared, hc, run, notify, keys, nextCommand, exec } from "herdr";
import { loadDiff, loadFile, isLine, anchor, message } from "./diff.js";
import { treeOrder, treeRows } from "./tree.js";
import { wrapSpans, lineCount, pairs } from "./layout.js";

export const DRAFTS = "review.drafts";
const VIEWED = "review.viewed", PREFS = "review.prefs";
const ROW = 22, FILE_ROW = 29, FILE_PAD = 6, INDENT = 12;
// Monospace advance at 12.5px, rounded up so a wrapped line never runs past the edge.
const CHAR_W = 7.6, GUTTER = 3 + 46 + 46 + 18 + 32, SIDE_GUTTER = 3 + 46 + 18 + 16, SPLIT_MIN = 1000;
const FOLD_LINES = 1500, EXPAND_STEP = 20, COMPOSER_ROWS = 8;
const LIST_W = 300, LIST_MIN = 160, DIFF_MIN = 360;
const GENERATED = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock|Pipfile\.lock|go\.sum|flake\.lock)$|\.min\.(js|css)$|\.map$/;
// Theme colors come as #rrggbb or #rrggbbaa; a tint multiplies more transparency into either.
const tint = (color, alpha) => {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color ?? "");
  if (!m) return color;
  const a = Math.round(parseInt(alpha, 16) * parseInt(m[2] ?? "ff", 16) / 255);
  return `#${m[1]}${a.toString(16).padStart(2, "0")}`;
};
const STATUS_COLOR = { A: "ansi2", D: "ansi1", M: "blocked" };

const drafts = () => shared(DRAFTS) ?? {};
const lineKey = (rows, i) => ({ kind: rows[i].kind, num: rows[i].new ?? rows[i].old, text: rows[i].text, above: rows[i - 1]?.text });
// The row an anchor names: same kind and text, nearest its old number, since lines added above
// shift every number. A matching line above wins first, so an inserted copy of a common line
// like `}` doesn't take the anchor. Anchors saved without text use the last line of their
// comment's code, or the number alone.
function findLine(rows, at, code) {
  const text = at.text ?? code?.split("\n").at(-1)?.slice(1);
  let best = -1, miss = true, gap = Infinity;
  rows.forEach((r, i) => {
    const n = r.new ?? r.old;
    if (!isLine(r) || r.kind !== at.kind || (text === undefined ? n !== at.num : r.text !== text)) return;
    const m = at.above !== undefined && rows[i - 1]?.text !== at.above, g = Math.abs(n - at.num);
    if (m < miss || (m === miss && g < gap)) { best = i; miss = m; gap = g; }
  });
  return best;
}

// The rows a comment covers now: its anchor line and, above it, as many diff lines as its code has.
function span(rows, c) {
  const end = rows ? findLine(rows, c.at, c.code) : -1;
  if (end < 0) return null;
  let start = end, left = (c.code ?? "").split("\n").length;
  while (left > 1 && start > 0) { start--; if (isLine(rows[start])) left--; }
  return { start, end };
}

// A comment's anchor, line label and code as they are now; as saved once its line is gone.
const resolve = (c, rows) => {
  const s = span(rows, c);
  return s ? { ...c, at: lineKey(rows, s.end), ...anchor(rows, s.start, s.end) } : c;
};
const textLines = (text) => text.split("\n").length;
const folded = (f) => !f.opened && (GENERATED.test(f.path) || f.add + f.del > FOLD_LINES);
const signature = (f) => `${f.status}:${f.add}:${f.del}`;

// The module outlives the overlay, so a reopen shows the last diff at once while it reloads.
const roots = new Map(), lasts = new Map(), LASTS = 6;
let charW = null;
const whereKey = (w) => `${w.on ?? ""}:${w.cwd}`;
const lastKey = (on, root, mode) => `${on ?? ""}:${root}:${mode}`;
const rowsText = (rows) => rows.map((r) => `${r.kind}${r.old ?? ""},${r.new ?? ""} ${r.text}`).join("\n");
const nearestLine = (rows, i) => {
  for (let d = 0; d < rows.length; d++) {
    if (isLine(rows[i - d])) return i - d;
    if (isLine(rows[i + d])) return i + d;
  }
  return 0;
};

// New files keep the colored rows of the last load: for good when the diff text and theme are
// the same, otherwise until their new colors land (stale), so nothing blanks or flashes plain.
function carry(files, old, dark) {
  const before = new Map(old.filter((f) => f.painted).map((f) => [f.path, f]));
  for (const f of files) {
    const o = before.get(f.path);
    if (!o) continue;
    const same = Boolean(f.rows) && o.dark === dark && rowsText(f.rows) === rowsText(o.rows);
    Object.assign(f, { rows: o.rows, dark: o.dark, painted: true, colored: same, stale: !same, opened: o.opened });
  }
  return files;
}

// Plain keys the view reads itself. Chords live in keys.json under "mod:review", which the app
// resolves ahead of global bindings, so a global chord can never swallow one of them.
const OWN_KEYS = ["j", "k", "h", "l", "[", "]", "c", "e", "d", "n", "v", "w", "o", "/", "|", "b", "r", "q",
  "enter", "escape", "tab", "backspace", "up", "down", "left", "right"];
const GLYPH = { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃", enter: "↵", escape: "esc", tab: "tab" };
const pretty = (chord) => chord ? chord.split("-").map((p) => GLYPH[p] ?? p.toUpperCase()).join("") : "unbound";
const bound = (action) => keys().filter((b) => b.section === "mod:review" && b.action === `review.${action}`)
  .map((b) => b.keys).sort((x, y) => x.length - y.length)[0] ?? null;

// Global or layout bindings that would take a key the view handles itself.
function clashes() {
  const all = keys(), mine = new Set(all.filter((b) => b.section === "mod:review").map((b) => b.keys));
  return all.filter((b) => (b.section === "global" || b.section === `layout:${shared("layout")}`) && !mine.has(b.keys)
    && OWN_KEYS.includes(b.keys.replace(/^shift-/, "")));
}

export default class Review extends View {
  init(_props, cx) {
    const f = focused(), space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
    this.where = { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null, space: space?.id, tab: f?.tab };
    const own = agents().filter((a) => a.space === this.where.space);
    this.target = (own.find((a) => a.address === f?.terminal) ?? own.find((a) => a.tab === f?.tab) ?? own[0])?.address ?? null;
    this.mode = "work";
    this.files = [];
    this.at = 0;
    this.sel = null;
    this.closed = new Set();
    this.filter = "";
    this.filtering = false;
    this.focus = "files";
    this.listOffset = 0;
    this.listH = 0;
    this.cursor = 0;
    this.from = null;
    this.composer = null;
    this.dragging = false;
    this.jump = null;
    this.offset = 0;
    this.viewH = 0;
    this.diffW = 0;
    this.handle = cx.focus_handle();
    this.input = TextareaState.new({ placeholder: "Comment · Enter to save · Shift+Enter for a new line", rows: 1 });
    this.input.on("submit", (e, cx) => { if (!e?.shift) this.save(cx); });
    this.input.on("change", (_e, cx) => cx.notify());
    this.filterInput = InputState.new({ placeholder: "Filter files" });
    this.filterInput.on("change", (_e, cx) => { this.filter = this.filterInput.value(); this.followFilter(cx); cx.notify(); });
    this.filterInput.on("submit", (_e, cx) => { this.filtering = false; this.handle.focus(); cx.notify(); });
    this.handle.focus();
    cx.timer.after(300, () => { if (!this.typing) this.handle.focus(); });
    this.root = roots.get(whereKey(this.where)) ?? null;
    const last = this.root && lasts.get(lastKey(this.where.on, this.root, this.mode));
    if (last) {
      Object.assign(this, { files: last.files, label: last.label, against: last.against, filesMode: this.mode });
      const i = this.files.findIndex((f) => f.path === last.path);
      this.pick(Math.max(0, i), cx);
      if (i >= 0) {
        const rows = this.file().rows, j = last.at ? findLine(rows, last.at) : -1;
        this.cursor = j >= 0 ? j : nearestLine(rows, last.cursor);
        this.offset = last.offset;
      }
    }
    this.reload(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "send") this.sendCommand(cx);
        else if (command === "reset") this.reset(cx);
        else if ((command === "half-down" || command === "half-up") && !this.typing) this.half(command === "half-down" ? 1 : -1);
        else if (command === "pane" && !this.typing) { this.focus = this.focus === "files" ? "diff" : "files"; this.handle.focus(); }
        cx.notify();
      }
    });
  }

  // Typing is whenever a text box is open; keys then belong to it.
  get typing() { return Boolean(this.composer) || this.filtering; }

  dismiss() {
    closeOverlay(props().overlay);
  }

  close() {
    this.gone = true;
    this.remember();
  }

  remember() {
    if (!this.root || !this.files.length) return;
    const key = lastKey(this.where.on, this.root, this.filesMode);
    lasts.delete(key);
    const row = this.file()?.rows?.[this.cursor];
    lasts.set(key, { files: this.files, label: this.label, against: this.against, path: this.file()?.path,
      at: isLine(row) ? lineKey(this.file().rows, this.cursor) : null, cursor: this.cursor, offset: this.offset });
    if (lasts.size > LASTS) lasts.delete(lasts.keys().next().value);
  }

  reload(cx) {
    this.loading = true; this.error = null;
    const mode = this.mode, seq = this.reloads = (this.reloads ?? 0) + 1;
    cx.spawn(async (cx) => {
      try {
        const { cwd, on } = this.where;
        if (!cwd) throw new Error("No folder");
        const { root, files, label, against } = await loadDiff(cwd, on, mode);
        if (seq !== this.reloads) return;
        this.root = root;
        roots.set(whereKey(this.where), root);
        const keep = this.files[this.at]?.path, prev = this.file()?.rows;
        const old = this.filesMode === mode ? this.files : [];
        this.files = carry(treeOrder(files), old, Boolean(settings().dark)); this.filesMode = mode; this.label = label; this.against = against;
        const i = this.files.findIndex((f) => f.path === keep);
        if (i >= 0 && old.length) this.stay(i, prev, cx);
        else this.pick(Math.max(0, i), cx);
        this.remember();
        this.prefetch(cx);
      } catch (e) { if (seq === this.reloads) { this.error = String(e?.message ?? e); this.files = []; } }
      finally { if (seq === this.reloads) this.loading = false; cx.notify(); }
    });
  }

  comments() { return this.root ? drafts()[this.root] ?? [] : []; }
  current() {
    const rows = new Map(this.files.map((f) => [f.path, f.rows]));
    return this.comments().map((c) => resolve(c, rows.get(c.path)));
  }
  setComments(list) { setShared(DRAFTS, { ...drafts(), [this.root]: list }); }

  prefs() { return shared(PREFS) ?? {}; }
  setPref(key, value) { setShared(PREFS, { ...this.prefs(), [key]: value }); }

  viewedMap() { return (shared(VIEWED) ?? {})[this.root] ?? {}; }
  isViewed(f) { return this.viewedMap()[f.path] === signature(f); }
  toggleViewed(f) {
    const all = shared(VIEWED) ?? {}, mine = { ...this.viewedMap() };
    if (this.isViewed(f)) delete mine[f.path]; else mine[f.path] = signature(f);
    setShared(VIEWED, { ...all, [this.root]: mine });
  }

  file() { return this.files[this.at] ?? null; }

  pick(index, cx) {
    if (!this.files.length) return;
    this.at = Math.min(Math.max(index, 0), this.files.length - 1);
    const file = this.file();
    this.sel = `f:${file.path}`;
    this.revealSel();
    this.from = null; this.composer = null;
    this.offset = 0;
    file.rows ??= [{ kind: "", text: "Loading…" }];
    this.cursor = Math.max(0, file.rows.findIndex(isLine));
    this.applyJump();
    if (!folded(file)) this.load(file, cx);
  }

  // A reload that keeps the same file selected keeps the place in it: cursor, scroll, range, comment box.
  stay(index, prev, cx) {
    this.at = index;
    const file = this.file();
    file.rows ??= [{ kind: "", text: "Loading…" }];
    this.remap(prev, file.rows);
    if (!folded(file)) this.load(file, cx);
  }

  // When the shown file's rows are replaced, the cursor and range follow their lines; the cursor
  // falls back to the nearest line, the range is dropped. The comment box is anchored by line already.
  remap(prev, next) {
    if (!prev || prev === next) return;
    const follow = (i) => isLine(prev[i]) ? findLine(next, lineKey(prev, i)) : -1;
    const cur = follow(this.cursor);
    this.cursor = cur >= 0 ? cur : nearestLine(next, Math.min(this.cursor, next.length - 1));
    if (this.from !== null) { const f = follow(this.from); this.from = f >= 0 ? f : null; }
  }

  // Waits until the selection rests, so moving through the list never waits on a diff.
  // A file not colored yet stays blank for up to 400ms rather than flash plain, then colored.
  load(file, cx) {
    this.hold = file.painted ? null : file;
    if (this.hold) cx.timer.after(400, (cx) => { if (this.hold === file) { this.hold = null; cx.notify(); } });
    if (file.colored) return;
    const token = this.picks = (this.picks ?? 0) + 1;
    cx.timer.after(150, (cx) => {
      if (token !== this.picks || file.colored) return;
      const files = this.files;
      cx.spawn(async (cx) => { await this.paint(file, () => files === this.files); cx.notify(); });
    });
  }

  async paint(file, still) {
    file.colored = true;
    const dark = Boolean(settings().dark);
    let prev;
    try {
      const loaded = await loadFile(this.root, this.where.on, file, this.against, dark, still);
      if (!loaded) { file.colored = false; return; }
      prev = file.rows;
      file.rows = loaded.rows;
      file.dark = dark;
      if (!loaded.cut) Object.assign(file, { add: loaded.add, del: loaded.del });
    } catch (e) { file.colored = false; file.dark = dark; prev = file.rows; file.rows = [{ kind: "", text: `Cannot show this diff: ${e?.message ?? e}` }]; }
    file.painted = true;
    file.stale = file.dark !== Boolean(settings().dark);
    if (file.stale) file.colored = false;
    if (this.file() !== file) return;
    if (this.hold === file) this.hold = null;
    this.remap(prev, file.rows);
    this.applyJump();
  }

  // A light/dark switch while open: each file keeps its old colors until its new ones land.
  recolor(cx) {
    for (const f of this.files) if (f.painted) Object.assign(f, { colored: false, stale: true });
    this.prefetch(cx);
  }

  // Colors the other files in the background, nearest the selection first, so moving to one
  // usually finds it ready.
  prefetch(cx) {
    const files = this.files, same = () => files === this.files;
    const near = (f) => Math.abs(files.indexOf(f) - this.at);
    cx.spawn(async (cx) => {
      for (;;) {
        if (!same() || this.gone) return;
        const next = files.filter((f) => !f.colored && (!f.painted || f.stale) && !folded(f)).sort((a, b) => near(a) - near(b))[0];
        if (!next) return;
        await this.paint(next, same);
        cx.notify();
      }
    });
  }

  openFolded(cx) {
    const file = this.file();
    if (!file || !folded(file)) return;
    file.opened = true;
    this.load(file, cx);
  }

  match() {
    const terms = this.filter.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.length ? (f) => terms.every((term) => f.path.toLowerCase().includes(term)) : null;
  }

  rows() { return treeRows(this.files, this.filter ? new Set() : this.closed, this.match()); }

  followFilter(cx) {
    const rows = this.rows();
    if (rows.some((r) => r.t === "file" && r.i === this.at)) { this.sel = `f:${this.file().path}`; return; }
    const first = rows.find((r) => r.t === "file");
    if (first) this.pick(first.i, cx);
  }

  selectRow(row, cx) {
    this.sel = row.key;
    if (row.t === "file" && row.i !== this.at) this.pick(row.i, cx);
    this.revealSel();
  }

  moveSel(step, cx) {
    const rows = this.rows();
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.key === this.sel);
    this.selectRow(rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + step))], cx);
  }

  toggleDir(path) {
    if (this.filter) return;
    if (this.closed.has(path)) this.closed.delete(path); else this.closed.add(path);
  }

  // Left closes a folder, or steps out to the folder holding the row; right opens one, or steps in.
  foldSel(open, cx) {
    const rows = this.rows(), i = rows.findIndex((r) => r.key === this.sel), row = rows[i];
    if (!row) return;
    if (row.t === "dir" && row.open !== open && !this.filter) return this.toggleDir(row.path);
    if (open) { if (row.t === "dir") this.moveSel(1, cx); else this.focus = "diff"; return; }
    for (let p = i - 1; p >= 0; p--) if (rows[p].t === "dir" && rows[p].depth < row.depth) return this.selectRow(rows[p], cx);
  }

  markViewed() {
    const rows = this.rows(), sel = rows.find((r) => r.key === this.sel);
    const file = this.focus === "files" ? (sel?.t === "file" ? this.files[sel.i] : null) : this.file();
    if (!file) return;
    this.toggleViewed(file);
  }

  scrollList(offset) {
    const max = Math.max(0, this.rows().length * FILE_ROW + 2 * FILE_PAD - this.listH);
    this.listOffset = Math.min(max, Math.max(0, offset));
  }

  revealSel() {
    if (!this.listH) return;
    const index = Math.max(0, this.rows().findIndex((r) => r.key === this.sel));
    const top = index * FILE_ROW, bottom = top + FILE_ROW + 2 * FILE_PAD;
    if (top < this.listOffset) this.scrollList(top);
    else if (bottom > this.listOffset + this.listH) this.scrollList(bottom - this.listH);
  }

  range() {
    const a = this.from ?? this.cursor;
    return [Math.min(a, this.cursor), Math.max(a, this.cursor)];
  }

  // The file list's width: live while its edge is dragged, else the saved one, always leaving the diff room.
  listWidth() {
    const w = this.listW ?? this.prefs().listW ?? LIST_W;
    return Math.max(LIST_MIN, this.bodyW ? Math.min(w, this.bodyW - DIFF_MIN) : w);
  }

  endResize(cx) {
    if (!this.resizing) return;
    if (this.listW != null) this.setPref("listW", this.listW);
    this.resizing = null; this.listW = null;
    cx.notify();
  }

  split() { return Boolean(this.prefs().split) && this.diffW >= SPLIT_MIN; }

  cols() {
    if (!this.prefs().wrap || !this.diffW) return 0;
    const width = this.split() ? (this.diffW - 1) / 2 - SIDE_GUTTER : this.diffW - GUTTER;
    return Math.max(20, Math.floor(width / (charW ?? CHAR_W)));
  }

  composerRows() { return Math.min(COMPOSER_ROWS, Math.max(1, textLines(this.input.value()))); }

  // The diff as drawn: lines (one row, or a side-by-side pair), each followed by its comments
  // and the open comment box.
  items() {
    const file = this.file();
    if (!file || this.hold === file) return [];
    if (folded(file)) return [{ t: "folded" }];
    const rows = file.rows, lines = this.split() ? pairs(rows) : rows.map((_r, i) => ({ t: "row", i }));
    const where = new Map();
    lines.forEach((ln, n) => {
      if (ln.t === "row") where.set(ln.i, n);
      else { if (ln.l !== null) where.set(ln.l, n); if (ln.r !== null) where.set(ln.r, n); }
    });
    const placed = new Map(), loose = [];
    for (const c of this.comments()) {
      if (c.path !== file.path) continue;
      const i = findLine(rows, c.at, c.code);
      if (i < 0) loose.push(c);
      else placed.set(where.get(i), [...(placed.get(where.get(i)) ?? []), resolve(c, rows)]);
    }
    const fresh = this.composer && !this.composer.id ? findLine(rows, this.composer.at) : -1;
    const composerLine = fresh >= 0 ? where.get(fresh) : undefined;
    const out = loose.map((c) => this.composer?.id === c.id ? { t: "composer", lost: true } : { t: "comment", c, loose: true });
    if (this.composer && !this.composer.id && fresh < 0) out.unshift({ t: "composer", lost: true });
    lines.forEach((ln, n) => {
      out.push(ln);
      for (const c of placed.get(n) ?? []) out.push(this.composer?.id === c.id ? { t: "composer" } : { t: "comment", c });
      if (composerLine === n) out.push({ t: "composer" });
    });
    return out;
  }

  height(item, cols = this.cols()) {
    const rows = this.file()?.rows ?? [];
    if (item.t === "row") return ROW * (isLine(rows[item.i]) ? lineCount(rows[item.i], cols) : 1);
    if (item.t === "pair") return ROW * Math.max(lineCount(rows[item.l], cols), lineCount(rows[item.r], cols));
    if (item.t === "composer") return 56 + 18 * this.composerRows();
    if (item.t === "folded") return 96;
    return 34 + 18 * textLines(item.c.text);
  }

  tops(items) {
    const cols = this.cols(), tops = new Array(items.length + 1);
    tops[0] = 0;
    items.forEach((it, i) => { tops[i + 1] = tops[i] + this.height(it, cols); });
    return tops;
  }

  scrollTo(offset) {
    const max = Math.max(0, (this.total ?? 0) - this.viewH);
    this.offset = Math.min(max, Math.max(0, offset));
  }

  reveal(pad = ROW * 3) {
    const items = this.items(), tops = this.tops(items);
    this.total = tops[items.length];
    const c = this.cursor;
    const index = items.findIndex((it) => it.t === "row" ? it.i === c : it.t === "pair" && (it.l === c || it.r === c));
    if (index < 0) return;
    const top = tops[index], bottom = tops[index + 1];
    if (top - pad < this.offset || bottom + pad > this.offset + this.viewH) this.scrollTo(top - this.viewH / 2);
  }

  move(step, extend) {
    const rows = this.file()?.rows ?? [];
    let i = this.cursor;
    do i += step; while (i >= 0 && i < rows.length && !isLine(rows[i]));
    if (i < 0 || i >= rows.length) return;
    if (extend && this.from === null) this.from = this.cursor;
    if (!extend) this.from = null;
    this.cursor = i;
    this.reveal();
  }

  // Ctrl-d / ctrl-u: the view and the cursor move half a screen together, as in vim.
  half(step) {
    const rows = this.file()?.rows ?? [], lines = Math.max(1, Math.floor(this.viewH / ROW / 2));
    this.focus = "diff"; this.from = null;
    let i = this.cursor, left = lines;
    while (left > 0) {
      let next = i + step;
      while (next >= 0 && next < rows.length && !isLine(rows[next])) next += step;
      if (next < 0 || next >= rows.length) break;
      i = next; left--;
    }
    this.cursor = i;
    this.scrollTo(this.offset + step * lines * ROW);
    this.reveal(0);
  }

  hunk(step) {
    const rows = this.file()?.rows ?? [];
    let i = this.cursor + step;
    while (i >= 0 && i < rows.length && rows[i].kind !== "@") i += step;
    if (step < 0) { i--; while (i >= 0 && rows[i].kind !== "@") i--; }
    if (i < 0 || i >= rows.length) return;
    this.from = null; this.cursor = i;
    this.move(1, false);
  }

  // Shows up to EXPAND_STEP hidden lines above a hunk, read from the working tree.
  expand(i, cx) {
    const file = this.file(), rows = file?.rows, r = rows?.[i];
    if (!r || r.kind !== "@" || file.status === "D") return;
    let p = i - 1;
    while (p >= 0 && rows[p].old === undefined) p--;
    const gap = r.old - (p >= 0 ? rows[p].old + 1 : 1);
    if (gap <= 0) return;
    cx.spawn(async (cx) => {
      if (!file.source) {
        const res = await exec("cat", ["--", file.path], { cwd: this.root, on: this.where.on });
        if (res.code !== 0) return;
        file.source = res.stdout.split("\n");
      }
      if (file.rows !== rows || rows[i] !== r) return;
      const k = Math.min(EXPAND_STEP, gap), shown = [];
      for (let n = k; n >= 1; n--) shown.push({ kind: " ", old: r.old - n, new: r.new - n, text: file.source[r.new - n - 1] ?? "" });
      rows.splice(i + 1, 0, ...shown);
      r.old -= k; r.new -= k;
      if (this.cursor > i) this.cursor += k;
      if (this.from !== null && this.from > i) this.from += k;
      cx.notify();
    });
  }

  compose() {
    const file = this.file();
    if (!file || !isLine(file.rows[this.cursor])) return;
    const [from, to] = this.range();
    this.composer = { id: null, at: lineKey(file.rows, to), ...anchor(file.rows, from, to) };
    this.input.set_value("");
    this.input.focus();
  }

  // The comment whose lines the cursor is on: its anchor row and the rows its code covers above it.
  commentAt() {
    const file = this.file();
    if (!file) return null;
    const rows = file.rows;
    for (const c of this.comments()) {
      if (c.path !== file.path) continue;
      const s = span(rows, c);
      if (s && this.cursor >= s.start && this.cursor <= s.end) return { c: resolve(c, rows), end: s.end };
    }
    return null;
  }

  edit(hit) {
    if (!hit) return;
    this.from = null;
    this.composer = { id: hit.c.id, lines: hit.c.lines };
    this.input.set_value(hit.c.text);
    this.input.focus();
  }

  save(cx) {
    const text = this.input.value().trim(), file = this.file(), c = this.composer;
    if (!c || !file) return;
    const list = this.comments();
    if (c.id) this.setComments(text ? list.map((x) => x.id === c.id ? { ...resolve(x, file.rows), text } : x) : list.filter((x) => x.id !== c.id));
    else if (text) {
      const r = resolve(c, file.rows);
      this.setComments([...list, { id: `c${Date.now()}`, path: file.path, at: r.at, text, lines: r.lines, code: r.code }]);
    }
    this.cancel(cx);
  }

  cancel(cx) {
    this.composer = null; this.from = null;
    this.input.set_value("");
    this.handle.focus();
    cx.notify();
  }

  remove() {
    const hit = this.commentAt();
    if (hit) this.setComments(this.comments().filter((c) => c.id !== hit.c.id));
  }

  // n / N: the next or previous comment in file order, opening its file.
  jumpComment(step, cx) {
    const index = new Map(this.files.map((f, i) => [f.path, i]));
    const list = this.comments().filter((c) => index.has(c.path))
      .sort((a, b) => index.get(a.path) - index.get(b.path) || a.at.num - b.at.num);
    if (!list.length) return;
    const row = this.file()?.rows?.[this.cursor], num = row?.new ?? row?.old ?? 0;
    const cmp = (c) => (index.get(c.path) - this.at) || (c.at.num - num);
    const c = step > 0 ? list.find((x) => cmp(x) > 0) ?? list[0] : [...list].reverse().find((x) => cmp(x) < 0) ?? list[list.length - 1];
    const fi = index.get(c.path);
    this.files[fi].opened = true;
    this.jump = c;
    this.focus = "diff";
    if (fi !== this.at) this.pick(fi, cx); else this.applyJump();
  }

  applyJump() {
    const file = this.file();
    if (!this.jump || this.jump.path !== file?.path) return;
    const i = findLine(file.rows, this.jump.at, this.jump.code);
    if (i < 0) return;
    this.cursor = i; this.from = null; this.jump = null;
    this.reveal();
  }

  startFilter() {
    this.focus = "files";
    this.filtering = true;
    this.filterInput.set_value(this.filter);
    this.filterInput.focus();
  }

  clearFilter(cx) {
    this.filtering = false; this.filter = "";
    this.filterInput.set_value("");
    this.sel = this.file() ? `f:${this.file().path}` : null;
    this.handle.focus();
    this.revealSel();
    cx.notify();
  }

  reset(cx) {
    if (this.composer) this.cancel(cx);
    else if (this.filtering || this.filter) this.clearFilter(cx);
    else { this.from = null; this.note = null; cx.notify(); }
  }

  agentList() { return agents().filter((a) => a.space === this.where.space); }

  // The send key saves an open comment, then sends.
  sendCommand(cx) {
    if (this.composer) return this.save(cx);
    if (this.filtering || !this.comments().length || !this.target) return;
    this.send(cx);
  }

  send(cx) {
    const list = this.comments(), target = this.target;
    if (!list.length || !target || this.sending) return;
    this.sending = true; this.note = null;
    const text = message(this.current(), this.label ?? "Uncommitted");
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["send", target, text]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || "hc send failed");
        this.setComments([]);
        notify({ title: "Review sent", body: `${list.length} comment${list.length === 1 ? "" : "s"} to ${target}`, level: "success", timeout: 3000 });
        run("pane.focus", { terminal: target });
        this.dismiss();
      } catch (e) { this.note = `Send failed: ${e?.message ?? e}`; }
      finally { this.sending = false; cx.notify(); }
    });
    cx.notify();
  }

  key(e, cx) {
    const k = e.key, m = e.modifiers, plain = !(m.platform || m.control || m.alt);
    if (this.typing) {
      if (k === "escape") { cx.stop_propagation(); this.reset(cx); }
      return;
    }
    this.dragging = false;
    const files = this.focus === "files";
    if (k === "escape") this.reset(cx);
    else if (k === "q" && plain) return this.dismiss();
    else if (!plain) return;
    else if (k === "/") this.startFilter();
    else if (k === "b") { this.mode = this.mode === "work" ? "branch" : "work"; this.reload(cx); }
    else if (k === "r") this.reload(cx);
    else if (k === "v") this.markViewed();
    else if (k === "w") this.setPref("wrap", !this.prefs().wrap);
    else if (k === "|" || k === "\\") this.setPref("split", !this.prefs().split);
    else if (k === "o") this.openFolded(cx);
    else if (k === "n" || k === "N") this.jumpComment(m.shift || k === "N" ? -1 : 1, cx);
    else if (files && (k === "j" || k === "down")) this.moveSel(1, cx);
    else if (files && (k === "k" || k === "up")) this.moveSel(-1, cx);
    else if (files && (k === "h" || k === "left")) this.foldSel(false, cx);
    else if (files && (k === "l" || k === "right")) this.foldSel(true, cx);
    else if (files && k === "enter") { const row = this.rows().find((r) => r.key === this.sel); if (row?.t === "dir") this.toggleDir(row.path); else if (row) this.focus = "diff"; }
    else if (files) return;
    else if (k === "h" || k === "left") this.focus = "files";
    else if (k === "j" || k === "down") this.move(1, m.shift);
    else if (k === "k" || k === "up") this.move(-1, m.shift);
    else if (k === "]") this.hunk(1);
    else if (k === "[") this.hunk(-1);
    else if (k === "c" || k === "enter") this.compose();
    else if (k === "e") this.edit(this.commentAt());
    else if (k === "d" || k === "backspace") this.remove();
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  // Press picks a line (shift extends, a double press comments); dragging across lines selects them.
  lineMouse(el, i) {
    return el.on_mouse_down("left", (e, cx) => {
      if (this.composer) {
        if (this.input.value().trim()) { this.input.focus(); return; }
        this.cancel(cx);
      }
      if (e.modifiers.shift) { if (this.from === null) this.from = this.cursor; }
      else this.from = null;
      this.cursor = i;
      this.focus = "diff";
      this.dragging = true;
      this.dragFrom = i;
      this.handle.focus();
      if (e.click_count === 2) { this.dragging = false; this.compose(); }
      cx.notify();
    }).on_mouse_move((_e, cx) => {
      if (!this.dragging || this.cursor === i) return;
      if (this.from === null) this.from = this.dragFrom;
      this.cursor = i;
      cx.notify();
    });
  }

  code(r, cols, t, hue) {
    return wrapSpans(r.spans ?? [{ text: r.text }], cols).map((line, k) =>
      h_flex().h(ROW).flex_none().items_center().children(line.length ? line.map((s) =>
        div().flex_none().whitespace_nowrap().when(Boolean(charW), (el) => el.w(s.text.length * charW)).text_color(s.fg ?? t.foreground).when(Boolean(s.emph && hue), (el) => el.bg(tint(hue, "40")).rounded(2)).child(s.text))
        : [div().child(" ")]));
  }

  separator(i, t) {
    const rows = this.file().rows, r = rows[i];
    let p = i - 1;
    while (p >= 0 && rows[p].old === undefined) p--;
    const gap = r.old - (p >= 0 ? rows[p].old + 1 : 1);
    const more = gap > 0 && this.file().status !== "D";
    return h_flex().id(`r${i}`).w_full().h(ROW).gap(10).px(14).items_center().bg(tint(t.accent, "12")).text_color(t.dim)
      .when(more, (el) => el.cursor_pointer().hover((s) => s.bg(tint(t.accent, "24")))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.expand(i, cx); }))
      .child(div().text_color(t.accent).child(more ? "↕" : "⋯"))
      .when(gap > 0, (el) => el.child(div().child(`${gap} unchanged line${gap === 1 ? "" : "s"}${more ? `, click to show ${Math.min(gap, EXPAND_STEP)}` : ""}`)))
      .when(Boolean(r.text), (el) => el.child(div().truncate().text_color(t.muted).child(r.text)));
  }

  row(i, t) {
    const r = this.file().rows[i], [from, to] = this.range(), cols = this.cols();
    if (r.kind === "@") return this.separator(i, t);
    if (!isLine(r)) return div().id(`r${i}`).w_full().h(ROW).px(14).flex().items_center().text_color(t.dim).child(r.text);
    const picked = this.from !== null && i >= from && i <= to, here = i === this.cursor && this.focus === "diff";
    const hue = r.kind === "+" ? t.ansi2 : r.kind === "-" ? t.ansi1 : null;
    const lines = this.code(r, cols, t, hue), h = ROW * lines.length;
    const num = (n) => div().w(46).h(ROW).flex_none().flex().items_center().justify_end().pr(10).text_color(hue ?? t.dim).opacity(hue ? 0.85 : 0.6).child(n === undefined ? "" : String(n));
    return this.lineMouse(h_flex().id(`r${i}`).w_full().h(h).items_start().cursor_pointer(), i)
      .when(Boolean(hue), (el) => el.bg(tint(hue, "14")))
      .when(picked, (el) => el.bg(tint(t.accent, "26")))
      .when(here, (el) => el.bg(tint(t.accent, "1f")))
      .hover((s) => s.bg(tint(t.accent, "14")))
      .child(div().w(3).h(h).flex_none().when(Boolean(hue), (el) => el.bg(hue)).when(here, (el) => el.bg(t.accent)))
      .child(h_flex().h(h).flex_none().items_start().when(Boolean(hue), (el) => el.bg(tint(hue, "1a"))).child(num(r.old)).child(num(r.new)))
      .child(div().w(18).h(ROW).flex_none().flex().items_center().pl(6).text_color(hue ?? t.dim).child(r.kind === " " ? "" : r.kind))
      .child(v_flex().flex_none().pr(24).children(lines));
  }

  side(i, which, h, cols, t) {
    if (i === null) return div().flex_1().min_w(0).h(h).bg(t.border);
    const r = this.file().rows[i], [from, to] = this.range();
    const picked = this.from !== null && i >= from && i <= to, here = i === this.cursor && this.focus === "diff";
    const hue = r.kind === "+" ? t.ansi2 : r.kind === "-" ? t.ansi1 : null, n = which === "l" ? r.old : r.new;
    return this.lineMouse(h_flex().id(`${which}${i}`).flex_1().min_w(0).h(h).items_start().overflow_hidden().cursor_pointer(), i)
      .when(Boolean(hue), (el) => el.bg(tint(hue, "14")))
      .when(picked, (el) => el.bg(tint(t.accent, "26")))
      .when(here, (el) => el.bg(tint(t.accent, "1f")))
      .hover((s) => s.bg(tint(t.accent, "14")))
      .child(div().w(3).h(h).flex_none().when(Boolean(hue), (el) => el.bg(hue)).when(here, (el) => el.bg(t.accent)))
      .child(div().w(46).h(ROW).flex_none().flex().items_center().justify_end().pr(10).text_color(hue ?? t.dim).opacity(hue ? 0.85 : 0.6).child(n === undefined ? "" : String(n)))
      .child(div().w(18).h(ROW).flex_none().flex().items_center().pl(6).text_color(hue ?? t.dim).child(r.kind === " " ? "" : r.kind))
      .child(v_flex().flex_none().pr(16).children(this.code(r, cols, t, hue)));
  }

  pair(item, t) {
    const h = this.height(item), cols = this.cols();
    return h_flex().id(`p${item.l}-${item.r}`).w_full().h(h)
      .child(this.side(item.l, "l", h, cols, t))
      .child(div().w(1).h(h).flex_none().bg(t.border))
      .child(this.side(item.r, "r", h, cols, t));
  }

  foldedView(t) {
    const file = this.file();
    return v_flex().id("folded").w_full().h(96).items_center().justify_center().gap(4).cursor_pointer()
      .text_color(t.dim).hover((s) => s.bg(t.hover))
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.openFolded(cx); cx.notify(); })
      .child(div().text_color(t.muted).child(GENERATED.test(file.path) ? "Generated file, hidden" : "Large diff, hidden"))
      .child(h_flex().gap(8).text_size(12)
        .child(div().text_color(t.ansi2).child(`+${file.add}`)).child(div().text_color(t.ansi1).child(`−${file.del}`))
        .child(div().child("o or click to show")));
  }

  comment(c, loose, t) {
    return v_flex().id(`c-${c.id}`).w_full().px(12).py(5).child(
      v_flex().ml(116).max_w(820).px(10).py(5).gap(2).rounded(6).border_1().border_color(c.id === this.hit ? t.accent : tint(t.accent, "80")).bg(t.popover)
        .child(h_flex().gap(8).text_size(11).text_color(t.dim)
          .child(div().child(loose ? `line ${c.lines} (no longer in the diff)` : `line ${c.lines}`))
          .child(div().flex_1())
          .when(!loose, (el) => el.child(div().id(`edit-${c.id}`).cursor_pointer().hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { this.focus = "diff"; const end = findLine(this.file().rows, c.at, c.code); this.cursor = end; this.edit({ c, end }); cx.notify(); }).child("edit")))
          .child(div().id(`del-${c.id}`).cursor_pointer().hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { this.setComments(this.comments().filter((x) => x.id !== c.id)); cx.notify(); }).child("delete")))
        .children(c.text.split("\n").map((line, i) => div().id(`cl-${c.id}-${i}`).h(18).font_family(settings().ui_font ?? "Geist").text_size(12.5).text_color(t.foreground).child(line || " "))));
  }

  composerView(t, lost) {
    const { lines } = this.composer.id ? this.composer : resolve(this.composer, this.file()?.rows), rows = this.composerRows();
    return v_flex().id("composer").w_full().px(12).py(6).child(
      v_flex().ml(116).max_w(820).gap(4)
        .child(div().text_size(11).text_color(t.dim).child(`${this.composer.id ? "Edit comment" : "Comment"} on line ${lines}${lost ? " (no longer in the diff)" : ""}`))
        .child(div().id("composer-box").h(16 + 18 * rows).px(10).py(4).rounded(7).border_1().border_color(t.accent).bg(t.background)
          .font_family(settings().ui_font ?? "Geist")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(Textarea.new(this.input).w_full().h_full().text_size(12.5).text_color(t.foreground))));
  }

  // Draws only the items in view; the list scrolls by moving them, not by laying all of them out.
  window(items, t) {
    const tops = this.tops(items);
    this.total = tops[items.length];
    this.scrollTo(this.offset);
    let start = 0;
    while (start < items.length && tops[start + 1] <= this.offset) start++;
    let end = start;
    // The first frame comes before the pane is measured; drawing a screenful keeps it from popping in.
    while (end < items.length && tops[end] < this.offset + (this.viewH || 2000) + ROW) end++;
    const draw = (it) => it.t === "row" ? this.row(it.i, t) : it.t === "pair" ? this.pair(it, t)
      : it.t === "comment" ? this.comment(it.c, it.loose, t) : it.t === "folded" ? this.foldedView(t) : this.composerView(t, it.lost);
    const thumb = this.total > this.viewH && this.viewH > 0;
    return div().absolute().inset_0()
      .child(v_flex().absolute().left(0).right(0).top(tops[start] - this.offset).children(items.slice(start, end).map(draw)))
      .when(thumb, (el) => el.child(div().absolute().right(2).w(4).rounded(2).bg(t.border)
        .top((this.offset / this.total) * this.viewH).h(Math.max(24, (this.viewH / this.total) * this.viewH))));
  }

  fileRow(row, t, counts, filesOn) {
    const sel = row.key === this.sel, pad = 8 + row.depth * INDENT;
    const base = h_flex().id(row.key).h(28).flex_none().pl(pad).pr(8).gap(6).items_center().rounded(7).cursor_pointer().text_size(12.5)
      .when(sel, (el) => el.bg(filesOn ? t.selected : t.hover)).hover((s) => s.bg(t.hover));
    if (row.t === "dir") {
      return base.on_click((_e, cx) => { this.sel = row.key; this.focus = "files"; this.filtering = false; this.toggleDir(row.path); this.handle.focus(); cx.notify(); })
        .child(div().w(12).flex_none().text_size(10).text_color(t.dim).child(row.open ? "▾" : "▸"))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(row.name))
        .when(!row.open, (el) => el.child(div().text_size(10.5).text_color(t.dim).child(String(row.count))));
    }
    const f = this.files[row.i], viewed = this.isViewed(f), current = row.i === this.at;
    return base.on_click((_e, cx) => { this.selectRow(row, cx); this.focus = "files"; this.filtering = false; this.handle.focus(); cx.notify(); })
      .child(div().w(12).flex_none().text_size(11).text_color(viewed ? t.dim : t[STATUS_COLOR[f.status]] ?? t.muted).child(viewed ? "✓" : f.status))
      .child(div().flex_1().min_w(0).truncate().text_color(viewed || folded(f) ? t.dim : current ? t.foreground : t.muted).child(row.name))
      .when(Boolean(counts[f.path]), (el) => el.child(div().px(5).rounded(4).bg(t.accent).text_color(t.accent_foreground).text_size(10.5).child(String(counts[f.path]))))
      .when(f.add > 0 && !viewed, (el) => el.child(div().text_size(10.5).text_color(t.ansi2).child(`+${f.add}`)))
      .when(f.del > 0 && !viewed, (el) => el.child(div().text_size(10.5).text_color(t.ansi1).child(`−${f.del}`)));
  }

  render(cx) {
    const dark = Boolean(settings().dark);
    if (this.dark !== undefined && this.dark !== dark) this.recolor(cx);
    this.dark = dark;
    this.hit = this.focus === "diff" && !this.composer ? this.commentAt()?.c.id : null;
    const t = theme(), file = this.file(), all = this.comments(), items = this.items(), prefs = this.prefs();
    const target = this.agentList().find((a) => a.address === this.target);
    const targetName = target ? terminals().find((x) => x.address === target.address)?.labels?.callsign || target.address : null;
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const viewed = this.files.filter((f) => this.isViewed(f)).length;
    const counts = {};
    for (const c of all) counts[c.path] = (counts[c.path] ?? 0) + 1;
    const canSend = all.length > 0 && Boolean(target) && !this.sending;
    const stop = (_e, cx) => cx.stop_propagation();
    const filesOn = this.focus === "files";

    const modeButton = (mode, label) => div().id(`mode-${mode}`).h(24).px(10).flex().items_center().rounded(6).cursor_pointer().text_size(12)
      .bg(this.mode === mode ? t.selected : t.chrome).text_color(this.mode === mode ? t.foreground : t.muted)
      .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop)
      .on_click((_e, cx) => { if (this.mode !== mode) { this.mode = mode; this.reload(cx); } }).child(label);
    const toggle = (key, label) => div().id(`pref-${key}`).h(22).px(8).flex().items_center().rounded(6).cursor_pointer().text_size(11.5)
      .bg(prefs[key] ? t.selected : t.chrome).text_color(prefs[key] ? t.foreground : t.dim)
      .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop)
      .on_click((_e, cx) => { this.setPref(key, !prefs[key]); cx.notify(); }).child(label);

    const header = h_flex().h(46).flex_none().px(14).gap(10).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(svg("mods/workspace-chrome/git-compare.svg").size(15).text_color(t.muted))
      .child(div().font_semibold().text_size(14).child("Review"))
      .child(h_flex().p(2).gap(2).rounded(8).border_1().border_color(t.border)
        .child(modeButton("work", "Uncommitted"))
        .child(modeButton("branch", "Branch")))
      .child(div().text_size(12).text_color(t.dim).child(this.loading && !this.files.length ? "Loading…" : `${this.files.length} files`))
      .child(div().text_size(12).text_color(t.ansi2).child(`+${add}`))
      .child(div().text_size(12).text_color(t.ansi1).child(`−${del}`))
      .when(this.files.length > 0, (el) => el.child(div().text_size(12).text_color(viewed === this.files.length ? t.ansi2 : t.dim).child(`${viewed}/${this.files.length} viewed`)))
      .child(div().flex_1())
      .when(!target, (el) => el.child(div().text_size(12).text_color(t.dim).child("No agent in this space")))
      .child(div().id("send").h(28).px(12).flex().items_center().rounded(7).text_size(12).font_semibold()
        .bg(canSend ? t.solid : t.raised).text_color(canSend ? t.solid_foreground : t.dim)
        .when(canSend, (el) => el.cursor_pointer()).on_mouse_down("left", stop).on_click((_e, cx) => this.sendCommand(cx))
        .child(this.sending ? "Sending…" : [`Send ${all.length || ""}`.trim(), targetName && `to ${targetName}`, pretty(bound("send"))].filter(Boolean).join(" ")));

    const rows = this.rows();
    const filterBar = (this.filtering || this.filter) && h_flex().id("filter").h(34).flex_none().mx(FILE_PAD).mt(FILE_PAD).px(8).gap(6).items_center().rounded(7)
      .border_1().border_color(this.filtering ? t.accent : t.border).bg(t.background).text_size(12.5)
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); if (!this.filtering) { this.startFilter(); cx.notify(); } })
      .child(div().text_color(t.dim).child("/"))
      .child(this.filtering ? div().flex_1().child(Input.new(this.filterInput).w_full().text_size(12.5).text_color(t.foreground))
        : div().flex_1().truncate().text_color(t.foreground).child(this.filter))
      .when(!this.filtering, (el) => el.child(div().id("filter-clear").text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.clearFilter(cx); }).child("×")));
    const listW = this.listWidth();
    const edge = div().id("list-edge").absolute().top(0).bottom(0).left(listW - 3).w(6).flex().justify_center().cursor_col_resize()
      .on_hover((hot, cx) => { this.edgeHot = hot; cx.notify(); })
      .when(Boolean(this.resizing || this.edgeHot), (el) => el.child(div().w(2).h_full().bg(t.accent)))
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        if (e.click_count === 2) { this.resizing = null; this.listW = null; this.setPref("listW", undefined); }
        else this.resizing = { x: e.position.x, w: listW };
        cx.notify();
      });
    const list = v_flex().w(listW).flex_none().bg(t.chrome).border_r(1).border_color(t.border)
      .when(Boolean(filterBar), (el) => el.child(filterBar))
      .child(div().id("review-files").flex_1().min_h(0).relative().overflow_hidden()
        .on_size_change((s, cx) => { if (s.height !== this.listH) { this.listH = s.height; this.revealSel(); cx.notify(); } })
        .on_scroll_wheel((e, cx) => { this.scrollList(this.listOffset - e.delta.y); cx.notify(); })
        .child(v_flex().absolute().left(0).right(0).top(-this.listOffset).p(FILE_PAD).gap(1)
          .children(rows.map((row) => this.fileRow(row, t, counts, filesOn)))
          .when(!rows.length, (el) => el.child(div().p(8).text_color(t.dim).text_size(12.5)
            .child(this.error ?? (this.loading ? "Loading changes…" : this.filter ? "No file matches" : "No changes"))))));

    const diff = v_flex().flex_1().min_w(0)
      .child(h_flex().h(32).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).text_size(12.5)
        .child(div().truncate().text_color(t.foreground).child(file?.path ?? ""))
        .when(Boolean(file) && this.isViewed(file), (el) => el.child(div().text_size(11).text_color(t.ansi2).child("✓ viewed")))
        .child(div().flex_1())
        .child(toggle("wrap", "Wrap"))
        .child(toggle("split", this.prefs().split && this.diffW < SPLIT_MIN ? "Split (too narrow)" : "Split"))
        .when(Boolean(file), (el) => el.child(div().text_size(11).text_color(t.dim).child(`${this.at + 1} / ${this.files.length}`))))
      .child(div().id("review-diff").flex_1().min_h(0).relative().overflow_hidden().font_family(settings().font_family ?? "JetBrains Mono").text_size(12.5).text_color(t.foreground)
        .on_size_change((s, cx) => { if (s.height !== this.viewH || s.width !== this.diffW) { this.viewH = s.height; this.diffW = s.width; cx.notify(); } })
        .on_scroll_wheel((e, cx) => { this.scrollTo(this.offset - e.delta.y); cx.notify(); })
        // Each text element rounds its width up to a pixel, so a line split into colored spans
        // drifts right. Spans get exact widths from one measured character instead.
        .child(div().id("char-probe").absolute().invisible().whitespace_nowrap().child("0".repeat(100))
          .on_size_change((s, cx) => { if (s.width / 100 !== charW) { charW = s.width / 100; cx.notify(); } }))
        .child(this.window(items, t)));

    const clash = clashes();
    const taken = !bound("send") ? "Send has no key: add \"mod:review\": { \"cmd-enter\": \"review.send\" } to keys.json"
      : clash.length ? `Taken by global keys: ${clash.map((b) => `${pretty(b.keys)} → ${b.action}`).join(", ")}` : null;
    const hint = (keys, what) => h_flex().gap(4).child(div().text_color(t.muted).child(keys)).child(div().child(what));
    const send = pretty(bound("send"));
    const hints = this.composer ? [["↵", "save"], ["⇧↵", "new line"], ["esc", "discard"]]
      : this.filtering ? [["↵", "done"], ["esc", "clear"]]
      : filesOn ? [["l ↵", "open"], ["j k", "move"], ["h l", "fold"], ["/", "filter"], ["v", "viewed"], ["n N", "comment"], ["b", "branch"], ["r", "reload"], [send, "send"], ["q", "close"]]
      : [["h", "files"], ["j k", "line"], ["⇧ drag", "range"], ["[ ]", "hunk"], ["⌃d ⌃u", "half page"], ["c", "comment"], ["e d", "edit delete"], ["n N", "next"],
        ...(file && folded(file) ? [["o", "show"]] : []), ["v", "viewed"], ["w", "wrap"], ["|", "split"], [send, "send"], ["q", "close"]];
    const footer = h_flex().h(28).flex_none().px(14).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .children(hints.map(([keys, what]) => hint(keys, what)))
      .child(div().flex_1())
      .when(Boolean(taken), (el) => el.child(div().text_color(t.blocked).child(taken)))
      .when(Boolean(this.note), (el) => el.child(div().text_color(t.ansi1).child(this.note)));

    return v_flex().id("review").size_full().min_h(0).overflow_hidden().bg(t.background).rounded(10).border_1().border_color(t.border).shadow_lg().text_color(t.foreground)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_mouse_down("left", () => { if (!this.typing) this.handle.focus(); })
      .on_mouse_up("left", (_e, cx) => { this.dragging = false; this.endResize(cx); })
      // Moves and releases only arrive while the pointer is over the overlay, so leaving it ends the drag.
      .on_hover((hovered, cx) => { if (!hovered) this.endResize(cx); })
      .on_mouse_move((e, cx) => {
        if (this.resizing) { this.listW = this.resizing.w + e.position.x - this.resizing.x; this.listW = this.listWidth(); cx.notify(); }
        if (!this.typing && !this.handle.is_focused()) this.handle.focus();
      })
      .child(header)
      .child(div().id("review-body").flex_1().min_h(0).relative()
        .on_size_change((s, cx) => { if (s.width !== this.bodyW) { this.bodyW = s.width; cx.notify(); } })
        .child(div().absolute().inset_0().flex().child(list).child(diff))
        .child(edge)
        .when(Boolean(this.resizing), (el) => el.child(div().id("resize-cover").absolute().inset_0().cursor_col_resize())))
      .child(footer);
  }
}
