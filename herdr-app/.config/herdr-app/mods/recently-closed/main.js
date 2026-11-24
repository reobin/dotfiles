// Recently closed panes, tabs and spaces, reopened from a popup (cmd-shift-t):
// each terminal back in its folder and its place in the splits, and a Claude
// or Codex session resumed where one was running (the resume mod's and the
// Codex hook's labels name them). Closing stays Herdr's own; a copy in a 0px
// layout block keeps a snapshot of every space, notices what disappears, and
// does the reopening, since the popup's copy ends when it closes.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, terminals, run, hc, shared, setShared, nextCommand, checking, readTextFile, home, props, closeOverlay, theme } from "herdr";

const CLOSED = "recently-closed.history";
const PICK = "recently-closed.pick";
const KEEP = 20;
// A close is recorded once its terminals have ended; still running by then, it was parked or moved.
const WAIT = 3000;
// Divider drags change sizes without changing the panes, so the trees are read again this often.
const REREAD = 5000;
const SAFE = /^[A-Za-z0-9._:@+=-]+$/;
// Each tab's split tree, from herdr-core's saved document, as toggle-split reads it.
const DOCS = `${home()}/.local/state/herdr-core/default/docs.json`;
const DIR = { row: "right", column: "down" };
const ROW = 40;
// A reopened terminal carries a `reopened-from.<address>=1` label per address it replaces, so an agent holding one finds it with `hc ls --label`.
const FROM = "reopened-from.";
// image() blurs these one-color 1em SVGs; svg() draws them crisp in their brand color.
const BRAND = { "icons/claude.svg": "#D97757", "icons/amp.svg": "#F34E3F", "icons/kiro.svg": "#9046FF", "icons/codex.svg": "#7A9DFF" };
const GLYPH = { "icons/codex.svg": "mods/tree/codex.svg" };

const leaves = (n) => (n.type === "block" ? [n] : (n.children ?? []).flatMap(leaves));
const term = (n) => leaves(n).find((b) => b.content?.terminal)?.content?.terminal;
const row = (list) => ({ type: "row", children: list.map((t) => ({ type: "block", content: { terminal: t } })) });

// The closed pane's split: the node beside it that took its room, and which side it was on.
function spot(node, terminal) {
  const kids = node.children ?? [];
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].type === "block" && kids[i].content?.terminal === terminal) {
      const first = i === 0;
      const sibling = kids[first ? 1 : i - 1];
      return sibling ? { type: node.type, sibling, first, size: kids[i].size } : null;
    }
    const found = spot(kids[i], terminal);
    if (found) return found;
  }
  return null;
}

function resize(id, size) {
  if (size) run("layout.resize", size.px !== undefined ? { id, px: size.px } : { id, weight: size.weight ?? 1 });
}

// Claude and Codex come back with their sessions; anything else is a shell in the pane's folder.
function launch(p = {}) {
  const flags = (p.flags ?? "").split(" ").filter(Boolean);
  if (p.session && SAFE.test(p.session) && flags.every((f) => SAFE.test(f))) {
    return { folder: p.sessionCwd || p.cwd, argv: ["claude", "--resume", p.session, ...flags] };
  }
  // The shell's codex alias adds --no-daemon; an argv skips the shell, so it goes here.
  if (p.codex && SAFE.test(p.codex)) return { folder: p.cwd, argv: ["codex", "resume", p.codex, "--no-daemon"] };
  return { folder: p.cwd };
}

// panes() and spaces() catch up with a command a moment after it runs.
async function until(cx, check, ms = 1000) {
  for (let waited = 0; waited <= ms; waited += 10) {
    const value = check();
    if (value) return value;
    await cx.sleep(10);
  }
  return null;
}

function short(path) {
  const h = home();
  return !path ? "" : path === h ? "~" : path.startsWith(h + "/") ? "~" + path.slice(h.length) : path;
}

function ago(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}

function icon(info, color) {
  if (!info?.icon) return div().size(15).flex_none();
  const tint = info.tint ? color : BRAND[info.icon];
  return tint ? svg(GLYPH[info.icon] ?? info.icon).size(15).flex_none().text_color(tint) : image(info.icon).w(15).h(15).flex_none();
}

export default class RecentlyClosed extends View {
  init(_props, cx) {
    this.overlay = props()?.overlay;
    if (this.overlay) {
      this.at = 0;
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    this.prev = null;
    this.waiting = []; // closes whose terminals haven't ended yet
    this.trees = new Map(); // tab id -> split tree, matching its live panes
    this.read = { key: null, at: 0 };
    cx.timer.every(500, (cx) => {
      if (checking()) return;
      this.watch();
      this.reread(cx);
    });
    cx.spawn(async (cx) => {
      for (;;) {
        if ((await nextCommand()) === "reopen") await this.reopen(cx);
      }
    });
  }

  closed() {
    return /** @type {any[]} */ (shared(CLOSED) ?? []);
  }

  reread(cx) {
    const ps = panes();
    const key = ps.map((p) => p.pane).join();
    if (this.reading || (key === this.read.key && Date.now() - this.read.at < REREAD)) return;
    this.reading = true;
    cx.spawn(async () => {
      try {
        const doc = JSON.parse((await readTextFile(DOCS)) ?? "null");
        const tabs = doc?.["herdr-app"]?.value?.spaces?.flatMap((s) => s.tabs) ?? [];
        const now = panes();
        for (const t of tabs) {
          const mine = now.filter((p) => p.tab === t.id).map((p) => p.pane).join();
          if (t.root && leaves(t.root).map((b) => b.id).join() === mine) this.trees.set(t.id, t.root);
        }
        this.read = { key, at: Date.now() };
      } catch (_) {
        this.read = { key: null, at: Date.now() };
      } finally {
        this.reading = false;
      }
    });
  }

  snapshot() {
    const ps = panes();
    const ts = new Map(terminals().map((t) => [t.address, t]));
    return spaces().filter((s) => !s.machine).map((s) => ({
      id: s.id, name: s.named ? s.name : null, index: s.index, active: s.active,
      tabs: s.tabs.map((tab) => {
        const mine = ps.filter((p) => p.tab === tab.id);
        const info = Object.fromEntries(mine.filter((p) => p.terminal).map((p) => {
          const l = ts.get(p.terminal)?.labels ?? {};
          return [p.terminal, {
            terminal: p.terminal, cwd: p.cwd, title: p.title || p.program?.name || "shell", icon: p.program?.icon ?? null, tint: Boolean(p.program?.tint),
            session: l["resume.session"] || null, sessionCwd: l["resume.cwd"] || null, flags: l["resume.flags"] || "", codex: l["codex.session"] || null, from: Object.keys(l).filter((k) => k.startsWith(FROM)).map((k) => k.slice(FROM.length)),
          }];
        }));
        const tree = this.trees.get(tab.id);
        const fits = tree && leaves(tree).map((b) => b.id).join() === mine.map((p) => p.pane).join();
        return { id: tab.id, name: tab.named ? tab.name : null, index: tab.index, active: tab.active, root: fits ? tree : row(Object.keys(info)), info };
      }),
    }));
  }

  // What lost its pane since the last look waits until its terminals have
  // ended, which can land a moment after the pane goes.
  watch() {
    const now = this.snapshot();
    const before = this.prev;
    this.prev = now;
    const at = Date.now();
    if (before) this.waiting.push(...this.lost(before, now, at));
    if (!this.waiting.length) return;
    const live = new Set(terminals().filter((t) => t.state === "live").map((t) => t.address));
    const ended = this.waiting.filter((e) => e.terminals.every((t) => !live.has(t)));
    this.waiting = this.waiting.filter((e) => !ended.includes(e) && at - e.seen < WAIT);
    if (ended.length) setShared(CLOSED, [...this.closed(), ...ended.map(({ terminals: _, seen: __, ...e }) => e)].slice(-KEEP));
  }

  // Only what was in sight when it closed counts, so agents tidying up
  // their own tabs in the background leave nothing to reopen.
  lost(before, now, at) {
    const kept = new Set(now.flatMap((s) => s.tabs.flatMap((t) => Object.keys(t.info))));
    const found = [];
    const add = (e) => found.push({ id: `${at}-${found.length}`, closed: at, seen: at, ...e });
    for (const s of before) {
      const ns = now.find((x) => x.id === s.id);
      const space = { id: s.id, name: s.name, index: s.index };
      const all = s.tabs.flatMap((t) => Object.keys(t.info));
      if (!ns) {
        const tabs = s.tabs.filter((t) => Object.keys(t.info).length);
        if (s.active && all.length && !all.some((t) => kept.has(t))) add({ kind: "space", space, tabs, terminals: all });
        continue;
      }
      // Shown before or after: a switch and a close can land in one tick.
      if (!s.active && !ns.active) continue;
      for (const tab of s.tabs) {
        const mine = Object.keys(tab.info);
        const nt = ns.tabs.find((x) => x.id === tab.id);
        if (!nt) {
          if (mine.length && !mine.some((t) => kept.has(t))) add({ kind: "tab", space, tabs: [tab], terminals: mine });
          continue;
        }
        if (!tab.active && !nt.active) continue;
        for (const t of mine.filter((t) => !kept.has(t))) add({ kind: "pane", space, tab, pane: tab.info[t], terminals: [t] });
      }
    }
    return found;
  }

  async reopen(cx) {
    this.watch();
    const list = this.closed();
    const e = list.find((x) => x.id === shared(PICK));
    setShared(PICK, null);
    if (!e) return;
    setShared(CLOSED, list.filter((x) => x !== e));
    const s = spaces().find((x) => x.id === e.space.id);
    const tabs = e.kind === "pane" ? [{ ...e.tab, root: row([e.pane.terminal]) }] : e.tabs;
    if (e.kind === "pane" && s?.tabs.some((t) => t.id === e.tab.id)) await this.pane(cx, e);
    else if (e.kind !== "space" && s) for (const tab of tabs) await this.tab(cx, s.id, tab);
    else await this.space(cx, e.space, tabs);
  }

  // Splits the node that took its room the way it was split, with both sizes
  // back; without one, it goes last in its tab.
  async pane(cx, e) {
    run("space.select", { id: e.space.id });
    run("tab.select", { id: e.tab.id });
    const live = panes().filter((p) => p.tab === e.tab.id);
    const at = spot(e.tab.root, e.pane.terminal);
    const near = at && live.find((p) => p.terminal === (at.first ? term(at.sibling) : leaves(at.sibling).at(-1)?.content?.terminal));
    const made = await this.open(cx, (near ?? live.at(-1))?.pane, e.pane, near ? DIR[at.type] : "right", e.tab.id);
    if (!made || !near) return;
    if (at.first) run("pane.swap", { pane: made, target: near.pane });
    if (at.sibling.type !== "block") return;
    resize(made, at.size);
    resize(near.pane, at.sibling.size);
  }

  async open(cx, pane, info, place, tab) {
    if (!pane) return null;
    const before = new Set(panes().map((p) => p.pane));
    run("pane.focus", { pane });
    run("terminal.open", { ...launch(info), place });
    const made = (await until(cx, () => panes().find((p) => p.tab === tab && !before.has(p.pane))))?.pane ?? null;
    if (made) await this.mark(cx, made, info);
    return made;
  }

  async mark(cx, pane, info) {
    const address = await until(cx, () => panes().find((p) => p.pane === pane)?.terminal);
    const from = [...(info?.from ?? []), info?.terminal].filter(Boolean).slice(-5);
    if (address && from.length) await hc(["label", address, ...from.map((a) => `${FROM}${a}=1`)]);
  }

  async tab(cx, space, tab) {
    const was = new Set(spaces().find((s) => s.id === space)?.tabs.map((t) => t.id));
    const l = launch(tab.info[term(tab.root)]);
    run("tab.new", { space, ...(tab.name ? { name: tab.name } : {}), folder: l.folder, ...(l.argv ? { argv: l.argv } : {}) });
    const made = await until(cx, () => spaces().find((s) => s.id === space)?.tabs.find((t) => !was.has(t.id)));
    if (!made) return;
    run("tab.move", { id: made.id, index: tab.index });
    await this.fill(cx, tab, made.id);
  }

  async space(cx, space, tabs) {
    const [first, ...others] = tabs;
    const was = new Set(spaces().map((s) => s.id));
    const l = launch(first.info[term(first.root)]);
    run("space.new", { ...(space.name ? { name: space.name } : {}), ...(first.name ? { tab: first.name } : {}), folder: l.folder, ...(l.argv ? { argv: l.argv } : {}) });
    const made = await until(cx, () => spaces().find((s) => !was.has(s.id) && s.tabs.length));
    if (!made) return;
    run("space.move", { id: made.id, index: space.index });
    await this.fill(cx, first, made.tabs[0].id);
    for (const tab of others) await this.tab(cx, made.id, tab);
    run("tab.select", { id: made.tabs[0].id });
  }

  async fill(cx, tab, id) {
    const pane = await until(cx, () => panes().find((p) => p.tab === id));
    if (!pane) return;
    await this.mark(cx, pane.pane, tab.info[term(tab.root)]);
    await this.build(cx, tab.root, pane.pane, tab.info, id);
  }

  // Lays a split out from the pane holding its first leaf: its other
  // children are split off one after another, sized, then built in turn.
  // Mod panes aren't rebuilt.
  async build(cx, node, pane, info, tab) {
    if (node.type === "block") return;
    const kids = (node.children ?? []).filter((c) => info[term(c)]);
    const slots = [pane];
    for (let k = 1; k < kids.length; k++) {
      const made = await this.open(cx, slots[k - 1], info[term(kids[k])], DIR[node.type], tab);
      if (!made) return;
      slots.push(made);
    }
    for (let k = 0; k < kids.length; k++) {
      resize(slots[k], kids[k].size);
      await this.build(cx, kids[k], slots[k], info, tab);
    }
  }

  pick(e) {
    closeOverlay(this.overlay);
    if (!e) return;
    setShared(PICK, e.id);
    run("recently-closed.reopen");
  }

  // A pane shows its own title; a tab or space its name, else its first pane's title, and how many panes came with it.
  describe(e) {
    const infos = e.kind === "pane" ? [e.pane] : e.tabs.flatMap((t) => Object.values(t.info));
    const lead = infos.find((i) => i.session || i.codex) ?? infos[0];
    const name = e.kind === "space" ? e.space.name : e.kind === "tab" ? e.tabs[0].name : null;
    const own = lead?.title && lead.title !== lead.terminal ? lead.title : "shell";
    return { lead, title: name || own, more: infos.length - 1 };
  }

  render() {
    if (!this.overlay) return div();
    const t = theme();
    const list = this.closed().slice().reverse();
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    const now = Date.now();
    const line = (e, i) => {
      const { lead, title, more } = this.describe(e);
      const where = [e.space.name, short(lead?.sessionCwd || lead?.cwd)].filter(Boolean).join(" · ");
      return h_flex().id(`rc-${e.id}`).mx(4).px(10).h(ROW).flex_none().rounded(7).gap(10).items_center().cursor_pointer()
        .when(i === this.at, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.pick(e))
        .child(div().w(30).flex_none().text_size(11).text_color(t.dim).child(ago(now - e.closed)))
        .when(Boolean(lead?.terminal), (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.accent + "1f").text_size(11).font_semibold().text_color(t.accent)
          .child(div().opacity(0.5).child(lead.terminal.slice(0, -2))).child(lead.terminal.slice(-2))))
        .child(icon(lead, t.dim))
        .child(div().flex_none().max_w(300).truncate().text_color(t.foreground).child(title))
        .when(e.kind !== "pane" || more > 0, (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.foreground + "0f").text_size(10.5).text_color(t.muted)
          .child(e.kind === "pane" ? `+${more}` : `${e.kind}${more > 0 ? ` +${more}` : ""}`)))
        .child(div().flex_1().truncate().text_size(11).text_color(t.dim).child(where));
    };
    return v_flex().id("recently-closed").track_focus(this.handle).w_full().min_h(0).p(18).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key, ctrl = e.modifiers.control;
        if (k === "escape") return closeOverlay(this.overlay);
        if (k === "enter") return this.pick(list[this.at]);
        if (k === "down" || k === "j" || (ctrl && k === "n")) this.at = Math.min(list.length - 1, this.at + 1);
        else if (k === "up" || k === "k" || (ctrl && k === "p")) this.at = Math.max(0, this.at - 1);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Recently closed")).child(div().text_size(11).text_color(t.dim).child("↵ reopen · Esc")))
      .child(v_flex().id("rc-list").flex_1().min_h(0).overflow_y_scroll().pb(6)
        .when(!list.length, (el) => el.child(div().p(10).text_color(t.dim).child("Nothing closed yet")))
        .children(list.map(line)));
  }
}
