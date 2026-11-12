import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Popup } from "gpui-base";
import { spaces, panes, agents, terminals, focused, theme, settings, props, closeOverlay, shared, setShared, hc, run, notify, keys, nextCommand, exec } from "herdr";
import { loadDiff, loadBases, loadFile, isLine, anchor, message } from "./diff.js";
import { treeOrder, treeRows } from "./tree.js";
import { wrapSpans, lineCount, pairs } from "./layout.js";

export const DRAFTS = "review.drafts";
const VIEWED = "review.viewed", PREFS = "review.prefs";
const ROW = 22, MARGIN = ROW * 3, FILE_ROW = 29, FILE_PAD = 6, INDENT = 12;
// Monospace advance at 12.5px, rounded up so a wrapped line never runs past the edge.
const CHAR_W = 7.6, CODE_X = 3 + 46 + 46 + 18, SIDE_CODE_X = 3 + 46 + 18, GUTTER = CODE_X + 32, SIDE_GUTTER = SIDE_CODE_X + 16, SPLIT_MIN = 1000;
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
const threadH = (lines) => 60 + 18 * lines;
const linesLabel = (lines) => lines.includes("-") ? `lines ${lines.replace("-", "–")}` : `line ${lines}`;
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
const OWN_KEYS = ["j", "k", "h", "l", "g", "z", "[", "]", "c", "e", "d", "n", "v", "w", "o", "/", "|", "b", "r", "q",
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
    this.branch = pane?.branch || space?.branch || null;
    const own = agents().filter((a) => a.space === this.where.space);
    this.target = (own.find((a) => a.address === f?.terminal) ?? own.find((a) => a.tab === f?.tab) ?? own[0])?.address ?? null;
    this.mode = "work";
    this.files = [];
    this.at = 0;
    this.sel = null;
    this.closed = new Set();
    this.opened = new Set();
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
    this.input = TextareaState.new({ placeholder: "Leave a comment", rows: 1 });
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
      Object.assign(this, { files: last.files, label: last.label, against: last.against, head: last.head, filesMode: this.mode, filesBase: null });
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
        this.count = null; this.prefix = null;
        if (this.help) { this.help = false; cx.notify(); continue; }
        if (command === "send") this.sendCommand(cx);
        else if (command === "reset") this.reset(cx);
        else if (this.typing || this.picker) continue;
        else if (command === "half-down" || command === "half-up") this.scroll(command === "half-down" ? 1 : -1, false);
        else if (command === "page-down" || command === "page-up") this.scroll(command === "page-down" ? 1 : -1, true);
        else if (command === "pane") { this.focus = this.focus === "files" ? "diff" : "files"; this.handle.focus(); }
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
    if (!this.root) return;
    const key = lastKey(this.where.on, this.root, this.filesMode);
    lasts.delete(key);
    if (!this.files.length) return;
    const row = this.file()?.rows?.[this.cursor];
    lasts.set(key, { files: this.files, label: this.label, against: this.against, head: this.head, path: this.file()?.path,
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
        const { root, files, label, against, head, bases, base } = await loadDiff(cwd, on, mode, this.wantedBase());
        if (seq !== this.reloads) return;
        this.root = root;
        roots.set(whereKey(this.where), root);
        const keep = this.files[this.at]?.path, prev = this.file()?.rows;
        // Another base is another diff: its files start fresh rather than keep the old base's rows.
        const old = this.filesMode === mode && this.filesBase === base ? this.files : [];
        this.files = carry(treeOrder(files), old, Boolean(settings().dark)); this.filesMode = mode; this.label = label; this.against = against;
        this.filesBase = base; this.head = head;
        if (bases) Object.assign(this, { bases, base });
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

  // The base picked for this branch is remembered per repo and branch.
  baseKey() { return this.root ? `${this.root}:${this.branch ?? ""}` : null; }
  wantedBase() { return this.prefs().bases?.[this.baseKey()]; }

  // The picker lists the uncommitted changes, then each base a branch review can start from.
  pickerItems() { return [{ mode: "work" }, ...(this.bases ?? []).map((base) => ({ mode: "branch", base }))]; }
  isCurrent(item) { return item.mode === this.mode && (item.mode === "work" || item.base.ref === this.base); }

  openPicker(cx) {
    if (!this.root) return;
    this.picker = { at: Math.max(0, this.pickerItems().findIndex((it) => this.isCurrent(it))) };
    // Bases come with a branch load; refreshed on each open so commit counts stay true.
    const seq = this.baseLoads = (this.baseLoads ?? 0) + 1;
    this.basesError = null;
    cx.spawn(async (cx) => {
      try {
        const bases = await loadBases(this.root, this.where.on);
        if (seq !== this.baseLoads) return;
        const at = this.pickerItems()[this.picker?.at];
        this.bases = bases;
        if (this.picker && at) this.picker.at = Math.max(0, this.pickerItems().findIndex((it) => it.mode === at.mode && it.base?.ref === at.base?.ref));
      } catch (e) { if (seq === this.baseLoads) this.basesError = String(e?.message ?? e); }
      cx.notify();
    });
  }

  choose(item, cx) {
    this.picker = null;
    if (item.mode === "branch") this.setPref("bases", { ...this.prefs().bases, [this.baseKey()]: item.base.ref });
    if (this.isCurrent(item)) return;
    this.mode = item.mode;
    if (item.mode === "branch") this.base = item.base.ref;
    this.reload(cx);
  }

  pickerKey(k, cx) {
    const items = this.pickerItems(), p = this.picker;
    if (k === "escape" || k === "q" || k === "B") this.picker = null;
    else if (k === "j" || k === "down") p.at = Math.min(items.length - 1, p.at + 1);
    else if (k === "k" || k === "up") p.at = Math.max(0, p.at - 1);
    else if (k === "enter" || k === "l") this.choose(items[p.at], cx);
    else if (/^[1-9]$/.test(k) && items[+k - 1]) this.choose(items[+k - 1], cx);
    cx.stop_propagation();
    cx.notify();
  }

  viewedMap() { return (shared(VIEWED) ?? {})[this.root] ?? {}; }
  isViewed(f) { return this.viewedMap()[f.path] === signature(f); }
  setViewed(list, on) {
    const all = shared(VIEWED) ?? {}, mine = { ...this.viewedMap() };
    for (const f of list) if (on) mine[f.path] = signature(f); else delete mine[f.path];
    setShared(VIEWED, { ...all, [this.root]: mine });
  }

  file() { return this.files[this.at] ?? null; }

  pick(index, cx) {
    if (!this.files.length) return;
    this.at = Math.min(Math.max(index, 0), this.files.length - 1);
    const file = this.file();
    this.sel = `f:${file.path}`;
    this.keepSel();
    this.from = null; this.composer = null; this.visual = false;
    this.offset = 0; this.over = false;
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

  // A folder whose files are all viewed starts closed; a fold by hand wins either way.
  rows() {
    const seen = this.viewedMap();
    const done = (under) => under.length > 0 && under.every((i) => seen[this.files[i].path] === signature(this.files[i]));
    const isClosed = (path, under) => !this.filter && (this.closed.has(path) || (!this.opened.has(path) && done(under)));
    return treeRows(this.files, isClosed, this.match()).map((r) => r.t === "dir" ? { ...r, viewed: done(r.files) } : r);
  }

  followFilter(cx) {
    const rows = this.rows();
    if (rows.some((r) => r.t === "file" && r.i === this.at)) { this.sel = `f:${this.file().path}`; return; }
    const first = rows.find((r) => r.t === "file");
    if (first) this.pick(first.i, cx);
  }

  selectRow(row, cx) {
    if (!row) return;
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

  toggleDir(row) {
    if (this.filter) return;
    const [into, from] = row.open ? [this.closed, this.opened] : [this.opened, this.closed];
    from.delete(row.path); into.add(row.path);
  }

  // Left closes a folder, or steps out to the folder holding the row; right opens one, or steps in.
  // Neither leaves the list: H, L, tab and enter move between it and the diff.
  foldSel(open, cx) {
    const rows = this.rows(), i = rows.findIndex((r) => r.key === this.sel), row = rows[i];
    if (!row) return;
    if (row.t === "dir" && row.open !== open && !this.filter) return this.toggleDir(row);
    if (open) { if (row.t === "dir") this.moveSel(1, cx); return; }
    for (let p = i - 1; p >= 0; p--) if (rows[p].t === "dir" && rows[p].depth < row.depth) return this.selectRow(rows[p], cx);
  }

  // On a folder, marks all its files viewed, or clears them when they all are, and lets it fold to match.
  markViewed() {
    const rows = this.rows(), sel = rows.find((r) => r.key === this.sel);
    if (this.focus === "files" && sel?.t === "dir") {
      this.setViewed(sel.files.map((i) => this.files[i]), !sel.viewed);
      this.closed.delete(sel.path); this.opened.delete(sel.path);
    } else {
      const file = this.focus === "files" ? (sel?.t === "file" ? this.files[sel.i] : null) : this.file();
      if (!file) return;
      this.setViewed([file], !this.isViewed(file));
    }
    this.keepSel();
  }

  // A selection folded out of sight moves up to the deepest folder still shown around it.
  keepSel() {
    const rows = this.rows();
    if (rows.some((r) => r.key === this.sel)) return;
    const path = this.sel?.slice(2) ?? "";
    const holder = rows.filter((r) => r.t === "dir" && path.startsWith(`${r.path}/`)).at(-1);
    if (holder) this.sel = holder.key;
    this.revealSel();
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
    if (item.t === "composer") return threadH(this.composerRows());
    if (item.t === "folded") return 96;
    return threadH(textLines(item.c.text));
  }

  tops(items) {
    const cols = this.cols(), tops = new Array(items.length + 1);
    tops[0] = 0;
    items.forEach((it, i) => { tops[i + 1] = tops[i] + this.height(it, cols); });
    return tops;
  }

  // `over` lets the view run past the end until the last line reaches the top, as vim's z
  // commands do; it lasts until a scroll brings the view back within the diff.
  scrollTo(offset, over = false) {
    const total = this.total ?? 0, max = Math.max(0, total - (over ? ROW : this.viewH));
    this.offset = Math.min(max, Math.max(0, offset));
    this.over = over && this.offset > total - this.viewH;
  }

  // The cursor line's top and bottom in the drawn diff.
  place() {
    const items = this.items(), tops = this.tops(items), c = this.cursor;
    this.total = tops[items.length];
    const index = items.findIndex((it) => it.t === "row" ? it.i === c : it.t === "pair" && (it.l === c || it.r === c));
    return index < 0 ? null : { top: tops[index], bottom: tops[index + 1] };
  }

  reveal(pad = MARGIN) {
    const p = this.place();
    if (p && (p.top - pad < this.offset || p.bottom + pad > this.offset + this.viewH)) this.scrollTo(p.top - this.viewH / 2);
  }

  move(step, extend) {
    extend ||= this.visual;
    const rows = this.file()?.rows ?? [];
    let i = this.cursor;
    do i += step; while (i >= 0 && i < rows.length && !isLine(rows[i]));
    if (i < 0 || i >= rows.length) return;
    if (extend && this.from === null) this.from = this.cursor;
    if (!extend) this.from = null;
    this.cursor = i;
    this.reveal();
  }

  jumpTo(i) {
    this.focus = "diff";
    if (!this.visual) this.from = null;
    this.cursor = i;
    this.reveal();
  }

  // gg / G: the first or last line; with a count, the line with that number, as the gutter shows it.
  goLine(n, end) {
    const rows = this.file()?.rows ?? [];
    let best = -1, gap = Infinity;
    if (n) rows.forEach((r, i) => { const g = isLine(r) ? Math.abs((r.new ?? r.old) - n) : Infinity; if (g < gap) { gap = g; best = i; } });
    else if (end < 0) best = rows.findIndex(isLine);
    else for (let i = rows.length - 1; i >= 0 && best < 0; i--) if (isLine(rows[i])) best = i;
    if (best >= 0) this.jumpTo(best);
  }

  // zz / zt / zb: scroll so the cursor line sits in the middle, at the top or at the bottom, keeping
  // the margin reveal() keeps so the next motion doesn't recenter.
  align(k) {
    const p = this.place();
    if (!p) return;
    if (k === "z") this.scrollTo((p.top + p.bottom - this.viewH) / 2, true);
    else if (k === "t") this.scrollTo(p.top - MARGIN, true);
    else if (k === "b") this.scrollTo(p.bottom + MARGIN - this.viewH, true);
  }

  // V: a line range that j, k and the other motions grow until a comment or escape ends it.
  toggleVisual() {
    if (this.visual) { this.visual = false; this.from = null; return; }
    if (!isLine(this.file()?.rows?.[this.cursor])) return;
    this.visual = true;
    this.from = this.cursor;
  }

  // Ctrl-d / ctrl-u half a screen, ctrl-f / ctrl-b a screen less two lines: the view and the
  // cursor move together, as in vim.
  scroll(step, whole) {
    const screen = Math.floor(this.viewH / ROW), lines = Math.max(1, whole ? screen - 2 : Math.floor(screen / 2));
    const rows = this.file()?.rows ?? [];
    this.focus = "diff";
    if (!this.visual) this.from = null;
    let i = this.cursor, left = lines;
    while (left > 0) {
      let next = i + step;
      while (next >= 0 && next < rows.length && !isLine(rows[next])) next += step;
      if (next < 0 || next >= rows.length) break;
      i = next; left--;
    }
    const before = this.offset;
    this.scrollTo(this.offset + step * lines * ROW, this.over);
    // A page cut short by the end of the diff must not pull the cursor back against the scroll.
    const edge = whole && this.offset !== before ? this.pageEdge(step, i) : i;
    this.cursor = step > 0 ? Math.max(edge, this.cursor) : Math.min(edge, this.cursor);
    this.reveal(0);
  }

  // After ctrl-f the cursor goes to the top line of the new page, after ctrl-b to the bottom one,
  // inside the margin reveal() keeps.
  pageEdge(step, fallback) {
    const items = this.items(), tops = this.tops(items), rows = this.file()?.rows ?? [], seen = [];
    items.forEach((it, n) => {
      if (tops[n] < this.offset + MARGIN || tops[n + 1] > this.offset + this.viewH - MARGIN) return;
      const i = it.t === "row" ? it.i : it.t === "pair" ? it.r ?? it.l : null;
      if (isLine(rows[i])) seen.push(i);
    });
    return seen.length ? seen[step > 0 ? 0 : seen.length - 1] : fallback;
  }

  // { / }: the previous or next empty line after some text, the cursor's own line included, as in
  // vim. A gap between hunks ends a paragraph too: the cursor stops on the last line before it, and
  // crosses it on the next press.
  paragraph(step) {
    const rows = this.file()?.rows ?? [];
    const edge = (i) => { let j = i - step; while (j !== this.cursor && !isLine(rows[j])) j -= step; return j; };
    let i = this.cursor + step, text = isLine(rows[this.cursor]) && rows[this.cursor].text !== "";
    for (; i >= 0 && i < rows.length; i += step) {
      const r = rows[i];
      if (r.kind === "@" && text) {
        if (edge(i) !== this.cursor) return this.jumpTo(edge(i));
        text = false;
      }
      if (!isLine(r)) continue;
      if (r.text !== "") text = true;
      else if (text) return this.jumpTo(i);
    }
    if (edge(i) !== this.cursor) this.jumpTo(edge(i));
  }

  hunk(step) {
    const rows = this.file()?.rows ?? [];
    let i = this.cursor + step;
    while (i >= 0 && i < rows.length && rows[i].kind !== "@") i += step;
    if (step < 0) { i--; while (i >= 0 && rows[i].kind !== "@") i--; }
    if (i < 0 || i >= rows.length) return;
    if (!this.visual) this.from = null;
    this.cursor = i;
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
    this.composer = null; this.from = null; this.visual = false;
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
    this.jump = null;
    this.jumpTo(i);
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
    if (this.picker || this.help) { this.picker = null; this.help = false; cx.notify(); }
    else if (this.composer) this.cancel(cx);
    else if (this.visual) { this.from = null; this.visual = false; cx.notify(); }
    else if (this.filtering || this.filter) this.clearFilter(cx);
    else { this.from = null; this.note = null; cx.notify(); }
    this.count = null; this.prefix = null;
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
    const m = e.modifiers, plain = !(m.platform || m.control || m.alt);
    // A shifted letter reads as its capital, however the platform reports it.
    const k = m.shift && /^[a-z]$/.test(e.key) ? e.key.toUpperCase() : e.key;
    if (this.typing) {
      if (k === "escape") { cx.stop_propagation(); this.reset(cx); }
      return;
    }
    if (this.picker) return this.pickerKey(k, cx);
    if (this.help) { this.help = false; cx.stop_propagation(); cx.notify(); return; }
    this.dragging = false;
    const files = this.focus === "files";
    // A count (42G, 5j) and a prefix (gg, zz) wait for the next key; any other key drops them.
    if (plain && !this.prefix && /^[0-9]$/.test(k) && (k !== "0" || this.count)) { this.count = (this.count ?? "") + k; cx.stop_propagation(); cx.notify(); return; }
    const count = this.count ? +this.count : null, times = Math.min(count ?? 1, 999), prefix = this.prefix;
    this.count = null; this.prefix = null;
    if (k === "escape") this.reset(cx);
    else if (!plain) return;
    else if (prefix === "g") { if (k === "g") { if (files) this.selectRow(this.rows()[0], cx); else this.goLine(count, -1); } }
    else if (prefix === "z") this.align(k);
    else if (k === "g" || (k === "z" && !files)) { this.prefix = k; this.count = count === null ? null : String(count); }
    else if (k === "q") return this.dismiss();
    else if (k === "?" || (k === "/" && m.shift)) this.help = true;
    else if (k === "/") this.startFilter();
    else if (k === "B") this.openPicker(cx);
    else if (k === "b") { this.mode = this.mode === "work" ? "branch" : "work"; this.reload(cx); }
    else if (k === "r") this.reload(cx);
    else if (k === "v") this.markViewed();
    else if (k === "w") this.setPref("wrap", !this.prefs().wrap);
    else if (k === "|" || k === "\\") this.setPref("split", !this.prefs().split);
    else if (k === "o") this.openFolded(cx);
    else if (k === "H") this.focus = "files";
    else if (k === "L") this.focus = "diff";
    else if (k === "n" || k === "N") this.jumpComment(k === "N" ? -1 : 1, cx);
    else if (files && (k === "j" || k === "down")) this.moveSel(times, cx);
    else if (files && (k === "k" || k === "up")) this.moveSel(-times, cx);
    else if (files && k === "G") this.selectRow(this.rows().at(-1), cx);
    else if (files && (k === "h" || k === "left")) this.foldSel(false, cx);
    else if (files && (k === "l" || k === "right")) this.foldSel(true, cx);
    else if (files && k === "enter") { const row = this.rows().find((r) => r.key === this.sel); if (row?.t === "dir") this.toggleDir(row); else if (row) this.focus = "diff"; }
    else if (files) return;
    else if (k === "j" || k === "down" || k === "J") for (let n = 0; n < times; n++) this.move(1, k === "J" || m.shift);
    else if (k === "k" || k === "up" || k === "K") for (let n = 0; n < times; n++) this.move(-1, k === "K" || m.shift);
    else if (k === "G") this.goLine(count, 1);
    else if (k === "V") this.toggleVisual();
    else if (k === "}" || (k === "]" && m.shift)) for (let n = 0; n < times; n++) this.paragraph(1);
    else if (k === "{" || (k === "[" && m.shift)) for (let n = 0; n < times; n++) this.paragraph(-1);
    else if (k === "]") for (let n = 0; n < times; n++) this.hunk(1);
    else if (k === "[") for (let n = 0; n < times; n++) this.hunk(-1);
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
      else { this.from = null; this.visual = false; }
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

  // A comment or the comment box: a band under its lines holding a card that lines up with the code,
  // its actions in the card's header. Its height is threadH(lines), which the scroll math relies on.
  thread(id, lines, active, label, actions, body, t) {
    return h_flex().id(id).w_full().h(threadH(lines)).items_start().bg(t.chrome).border_y(1).border_color(t.border)
      .child(div().w(3).h_full().flex_none().bg(active ? t.accent : tint(t.accent, "50")))
      .child(v_flex().flex_1().min_w(0).max_w(820).ml((this.split() ? SIDE_CODE_X : CODE_X) - 3).mr(24).my(7)
        .rounded(8).border_1().border_color(active ? t.accent : t.border).bg(t.background).overflow_hidden()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(h_flex().h(28).flex_none().pl(10).pr(4).gap(2).items_center().border_b(1).border_color(t.border).text_size(11.5).text_color(t.dim)
          .child(div().flex_1().min_w(0).truncate().child(label))
          .children(actions))
        .child(body));
  }

  action(id, label, keys, primary, t, onClick) {
    return h_flex().id(id).h(20).px(6).gap(6).items_center().rounded(5).cursor_pointer()
      .when(primary, (el) => el.bg(t.solid).text_color(t.solid_foreground))
      .when(!primary, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_click(onClick)
      .child(div().child(label)).child(div().opacity(0.6).child(keys));
  }

  comment(c, loose, t) {
    const label = `${linesLabel(c.lines)}${loose ? " · no longer in the diff" : ""}`;
    const edit = (_e, cx) => { this.focus = "diff"; const end = findLine(this.file().rows, c.at, c.code); this.cursor = end; this.edit({ c, end }); cx.notify(); };
    const remove = (_e, cx) => { this.setComments(this.comments().filter((x) => x.id !== c.id)); cx.notify(); };
    return this.thread(`c-${c.id}`, textLines(c.text), c.id === this.hit, label, [
      !loose && this.action(`edit-${c.id}`, "Edit", "e", false, t, edit),
      this.action(`del-${c.id}`, "Delete", "d", false, t, remove),
    ].filter(Boolean), v_flex().px(10).py(7).text_color(t.foreground)
      .children(c.text.split("\n").map((line, i) => div().id(`cl-${c.id}-${i}`).h(18).child(line || " "))), t);
  }

  composerView(t, lost) {
    const c = this.composer, { lines } = c.id ? c : resolve(c, this.file()?.rows), rows = this.composerRows();
    const filled = Boolean(this.input.value().trim());
    const label = `${c.id ? "Edit comment" : "Comment"} on ${linesLabel(lines)}${lost ? " · no longer in the diff" : ""}`;
    return this.thread("composer", rows, true, label, [
      this.action("composer-cancel", "Cancel", "esc", false, t, (_e, cx) => this.cancel(cx)),
      this.action("composer-save", c.id && !filled ? "Delete" : "Save", "↵", filled, t, (_e, cx) => this.save(cx)),
    ], div().h(14 + 18 * rows).px(10).py(4)
      .child(Textarea.new(this.input).w_full().h_full().text_size(12.5).text_color(t.foreground)), t);
  }

  // Draws only the items in view; the list scrolls by moving them, not by laying all of them out.
  window(items, t) {
    const tops = this.tops(items);
    this.total = tops[items.length];
    this.scrollTo(this.offset, this.over);
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
      return base.on_click((_e, cx) => { this.sel = row.key; this.focus = "files"; this.filtering = false; this.toggleDir(row); this.handle.focus(); cx.notify(); })
        .child(div().w(12).flex_none().text_size(10).text_color(t.dim).child(row.open ? "▾" : "▸"))
        .child(div().flex_1().min_w(0).truncate().text_color(row.viewed ? t.dim : t.muted).child(row.name))
        .when(!row.open, (el) => el.child(div().text_size(10.5).text_color(t.dim).child(String(row.count))))
        .when(row.viewed, (el) => el.child(div().text_size(11).text_color(t.ansi2).child("✓")));
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

    const commits = (n) => `${n} commit${n === 1 ? "" : "s"}`;
    const tag = (b) => { const parent = b.kind === "parent" && b.pushed;
      return div().flex_none().px(5).rounded(4).text_size(10.5)
        .when(parent, (el) => el.bg(tint(t.accent, "26")).text_color(t.accent))
        .when(!parent, (el) => el.border_1().border_color(t.border).text_color(t.dim))
        .child(parent ? "stack parent" : b.kind === "parent" ? "local only" : "default"); };
    const shown = this.bases?.find((b) => b.ref === this.base);
    const against = this.mode === "work"
      ? [div().text_color(t.foreground).child("HEAD"), this.head && div().text_color(t.dim).child(this.head.slice(0, 7))]
      : this.base ? [div().max_w(240).truncate().text_color(t.foreground).child(this.base), shown && tag(shown), shown && div().text_color(t.dim).child(commits(shown.ahead))]
      : [div().text_color(t.dim).child("…")];
    const chip = h_flex().id("base").h(26).px(8).gap(6).items_center().rounded(7).border_1().text_size(12).cursor_pointer()
      .border_color(this.picker ? t.accent : t.border).bg(this.picker ? t.selected : t.background)
      .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop)
      .on_click((_e, cx) => { if (this.picker) this.picker = null; else this.openPicker(cx); cx.notify(); })
      .when(this.loading, (el) => el.opacity(0.6))
      .child(div().text_color(t.dim).child("vs"))
      .children(against.filter(Boolean))
      .child(div().text_size(10).text_color(t.dim).child("▾"));
    const choices = this.picker ? this.pickerItems() : [];
    const option = (it, i) => {
      const on = this.picker.at === i, cur = this.isCurrent(it);
      return h_flex().id(`base-${i}`).h(30).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .when(on, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.choose(it, cx); cx.notify(); })
        .child(div().w(12).flex_none().text_color(t.accent).child(cur ? "✓" : ""))
        .child(div().min_w(0).truncate().text_color(cur || on ? t.foreground : t.muted).child(it.mode === "work" ? "Uncommitted changes" : it.base.ref))
        .when(it.mode === "branch", (el) => el.child(tag(it.base)))
        .child(div().flex_1())
        .child(div().flex_none().text_size(11).text_color(t.dim)
          .child(it.mode === "work" ? `HEAD ${this.head?.slice(0, 7) ?? ""}`.trim() : commits(it.base.ahead)))
        .child(div().w(10).flex_none().text_size(11).text_color(t.dim).child(i < 9 ? String(i + 1) : ""));
    };
    const group = (text) => div().px(8).pt(6).pb(2).text_size(10.5).text_color(t.dim).child(text);
    const menu = this.picker && v_flex().id("base-menu").w(400).mt(6).p(4).rounded(9).border_1().border_color(t.border).bg(t.background).shadow_lg()
      .text_size(12.5).on_mouse_down("left", stop)
      .child(group("Uncommitted, against HEAD"))
      .child(option(choices[0], 0))
      .child(div().h(1).mx(4).my(4).bg(t.border))
      .child(group("Branch, since it forked from"))
      .children(choices.slice(1).map((it, i) => option(it, i + 1)))
      .when(choices.length === 1, (el) => el.child(div().h(30).px(28).flex().items_center().text_color(this.basesError ? t.ansi1 : t.dim)
        .child(this.basesError ?? "Finding branches…")))
      .child(h_flex().mt(4).pt(6).pb(2).px(8).gap(12).border_t(1).border_color(t.border).text_size(10.5).text_color(t.dim)
        .child("j k move").child("↵ pick").child("1–9 jump").child("esc close"));
    const basePicker = Popup.new("base-picker", chip).anchor("top_left").when(Boolean(menu), (el) => el.content(menu));

    const header =h_flex().h(46).flex_none().px(14).gap(10).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().gap(4).flex_none().items_center().text_size(12).text_color(t.muted)
        .child(svg("mods/workspace-chrome/git-compare.svg").size(14).flex_none())
        .child(div().max_w(200).truncate().child(this.branch ?? "Review")))
      .child(h_flex().p(2).gap(2).rounded(8).border_1().border_color(t.border)
        .child(modeButton("work", "Uncommitted"))
        .child(modeButton("branch", "Branch")))
      .child(basePicker)
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
        .on_scroll_wheel((e, cx) => { this.scrollTo(this.offset - e.delta.y, this.over); cx.notify(); })
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
      : this.visual ? [["VISUAL", "line"], ["j k { } G", "extend"], ["c", "comment"], ["V esc", "cancel"]]
      : filesOn ? [["↵ L", "open"], ["/", "filter"], ["v", "viewed"], [send, "send"], ["?", "keys"]]
      : [["c", "comment"], ["V", "select"], ["v", "viewed"], ...(file && folded(file) ? [["o", "show"]] : []), [send, "send"], ["?", "keys"]];
    const sheet = this.help && this.helpSheet(t, send);
    const footer = h_flex().h(28).flex_none().px(14).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .children(hints.map(([keys, what]) => hint(keys, what)))
      .child(div().flex_1())
      .when(Boolean(taken), (el) => el.child(div().text_color(t.blocked).child(taken)))
      .when(Boolean(this.count || this.prefix), (el) => el.child(div().text_color(t.foreground).child(`${this.count ?? ""}${this.prefix ?? ""}`)))
      .when(Boolean(this.note), (el) => el.child(div().text_color(t.ansi1).child(this.note)));

    return v_flex().id("review").size_full().min_h(0).overflow_hidden().bg(t.background).rounded(12).border_1().border_color(t.border).shadow_lg().text_color(t.foreground)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_mouse_down("left", (_e, cx) => {
        if (this.picker || this.help) { this.picker = null; this.help = false; cx.notify(); }
        if (!this.typing) this.handle.focus();
      })
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
      .child(footer)
      .when(Boolean(sheet), (el) => el.child(sheet));
  }

  // ? opens every key, grouped; any key or a click closes it.
  helpSheet(t, send) {
    const key = (action, fallback) => bound(action) ? pretty(bound(action)) : fallback;
    const groups = [
      ["Moving in the diff", [["j k", "line down, up"], ["5j 42G", "count, go to line 42"], ["gg G", "first, last line"], ["{ }", "paragraph"], ["[ ]", "hunk"],
        [`${key("half-down", "⌃d")} ${key("half-up", "⌃u")}`, "half page"], [`${key("page-down", "⌃f")} ${key("page-up", "⌃b")}`, "page"], ["zz zt zb", "line to middle, top, bottom"]]],
      ["Comments", [["c ↵", "comment the line or range"], ["V", "select lines"], ["⇧j ⇧k", "extend the range"], ["e d", "edit, delete"], ["n N", "next, previous comment"], [send, "send to the agent"]]],
      ["Files", [["j k", "move"], ["gg G", "first, last"], ["h l", "fold, unfold"], ["/", "filter"], ["v", "mark viewed"], ["o", "show a hidden file"]]],
      ["Review", [["H L", "files, diff"], ["tab", "switch pane"], ["b", "uncommitted or branch"], ["B", "compare against"], ["r", "reload"], ["w |", "wrap, split"], ["q", "close"]]],
    ];
    const column = (list) => v_flex().flex_1().min_w(0).gap(16).children(list.map(([title, rows]) => v_flex().gap(2)
      .child(div().pb(4).text_size(11).text_color(t.dim).child(title))
      .children(rows.map(([keys, what]) => h_flex().h(22).gap(12).items_center()
        .child(div().w(84).flex_none().text_color(t.accent).font_family(settings().font_family ?? "JetBrains Mono").child(keys))
        .child(div().min_w(0).truncate().text_color(t.foreground).child(what))))));
    return div().id("help").absolute().inset_0().flex().items_center().justify_center().bg(tint(t.background, "b0"))
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.help = false; cx.notify(); })
      .child(v_flex().id("help-card").w(680).p(20).gap(16).rounded(12).border_1().border_color(t.border).bg(t.chrome).shadow_lg().text_size(12.5)
        .child(h_flex().items_center().child(div().flex_1().font_semibold().child("Review keys")).child(div().text_size(11).text_color(t.dim).child("any key to close")))
        .child(h_flex().gap(28).items_start().child(column(groups.slice(0, 2))).child(column(groups.slice(2)))));
  }
}
