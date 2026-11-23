// cmd-z rebuilds what was closed last: a pane, a tab or a whole space, with
// each terminal back in its folder and its place in the splits, and a Claude
// session resumed where one was running (the resume mod's labels name it).
// Closing stays Herdr's own; this keeps a snapshot of every space and notices
// what disappears. Draws nothing: the layout holds one copy in a 0px block,
// so the keys keep working while the sidebar is hidden.

import { View, div } from "gpui-kit";
import { spaces, panes, terminals, run, shared, setShared, nextCommand, checking, readTextFile, home } from "herdr";

const CLOSED = "undo-close.history";
const KEEP = 20;
// A close is recorded once its terminals have ended; still running by then, it was parked or moved.
const WAIT = 3000;
// Divider drags change sizes without changing the panes, so the trees are read again this often.
const REREAD = 5000;
const SAFE = /^[A-Za-z0-9._:@+=-]+$/;
// Each tab's split tree, from herdr-core's saved document, as toggle-split reads it.
const DOCS = `${home()}/.local/state/herdr-core/default/docs.json`;
const DIR = { row: "right", column: "down" };

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

// Claude comes back in its own folder; anything else is a shell in the pane's.
function launch(p = {}) {
  const flags = (p.flags ?? "").split(" ").filter(Boolean);
  if (!p.session || !SAFE.test(p.session) || !flags.every((f) => SAFE.test(f))) return { folder: p.cwd };
  return { folder: p.sessionCwd || p.cwd, argv: ["claude", "--resume", p.session, ...flags] };
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

export default class UndoClose extends View {
  init(_props, cx) {
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
        const c = await nextCommand();
        if (c === "undo") await this.undo(cx);
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
          return [p.terminal, { terminal: p.terminal, cwd: p.cwd, session: l["resume.session"] || null, sessionCwd: l["resume.cwd"] || null, flags: l["resume.flags"] || "" }];
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
  // their own tabs in the background leave nothing to undo.
  lost(before, now, at) {
    const kept = new Set(now.flatMap((s) => s.tabs.flatMap((t) => Object.keys(t.info))));
    const found = [];
    for (const s of before) {
      const ns = now.find((x) => x.id === s.id);
      const space = { id: s.id, name: s.name, index: s.index };
      const all = s.tabs.flatMap((t) => Object.keys(t.info));
      if (!ns) {
        const tabs = s.tabs.filter((t) => Object.keys(t.info).length);
        if (s.active && all.length && !all.some((t) => kept.has(t))) found.push({ kind: "space", closed: at, seen: at, space, tabs, terminals: all });
        continue;
      }
      // Shown before or after: a switch and a close can land in one tick.
      if (!s.active && !ns.active) continue;
      for (const tab of s.tabs) {
        const mine = Object.keys(tab.info);
        const nt = ns.tabs.find((x) => x.id === tab.id);
        if (!nt) {
          if (mine.length && !mine.some((t) => kept.has(t))) found.push({ kind: "tab", closed: at, seen: at, space, tabs: [tab], terminals: mine });
          continue;
        }
        if (!tab.active && !nt.active) continue;
        for (const t of mine.filter((t) => !kept.has(t))) {
          found.push({ kind: "pane", closed: at, seen: at, space, tab, pane: tab.info[t], terminals: [t] });
        }
      }
    }
    return found;
  }

  async undo(cx) {
    this.watch();
    const list = this.closed();
    const e = list.at(-1);
    if (!e) return;
    setShared(CLOSED, list.slice(0, -1));
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
    return (await until(cx, () => panes().find((p) => p.tab === tab && !before.has(p.pane))))?.pane ?? null;
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
    if (pane) await this.build(cx, tab.root, pane.pane, tab.info, id);
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

  render() {
    return div();
  }
}
