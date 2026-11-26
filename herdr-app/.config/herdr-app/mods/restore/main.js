// Saves spaces and builds them back: recently closed panes, tabs and spaces,
// reopened from a popup (cmd-shift-t), and archived groups, unarchived from
// the tree's archive (cmd-.). Each terminal comes back in its folder, its
// place in the splits and with its labels, and a Claude or Codex session
// resumes where one was running (the resume mod's and the Codex hook's labels
// name them). Closing stays Herdr's own; a copy in a 0px layout block keeps a
// snapshot of every space, notices what disappears, and does the reopening,
// since the popup's copy ends when it closes.
//
// An archived group is a record. Its spaces stay open, out of the active view,
// until every Claude in them has been quiet for QUIET ticks and the record
// holds every tab's splits and every Claude's session; then they close, so the
// group uses nothing. Unarchiving builds it back out of sight and shows it once
// its first Claude is ready, if the archive still has it selected.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, terminals, run, hc, exec, shared, setShared, nextCommand, checking, readTextFile, home, props, closeOverlay, theme, notify } from "herdr";

const CLOSED = "recently-closed.history";
const PICK = "recently-closed.pick";
// [{ id, name, at, state: "pending" | "closed" | "restoring", quiet, needs, wait, spaces: [{ id, done, repo, tabs }] }].
// A space's id is the live one while pending, its old one once closed; done is the id it was built back as.
// The tree and space-nav read it too; mods cannot import across folders.
const RECORDS = "restore.records";
// [{ op: "archive", ids } | { op: "unarchive" | "cancel", record }], sent by the tree.
const QUEUE = "restore.queue";
const SELECTED = "archive.selected";
const VIEW = "tree.view";
// The tree's archive before records; its spaces are archived here once, then the key is left alone.
const LEGACY = ["tree.archived", "tree.collapsed"];
const KEEP = 20;
// A close is recorded once its terminals have ended; still running by then, it was parked or moved.
const WAIT = 3000;
// Divider drags change sizes without changing the panes, so the trees are read again this often.
const REREAD = 5000;
const QUIET = 3;
const READY = 10000;
// Building out of sight waits on spaces() and panes() longer, since every Claude in the group starts at once.
const LONG = 5000;
const SAFE = /^[A-Za-z0-9._:@+=\/-]+$/;
// Each tab's split tree, from herdr-core's saved document, as toggle-split reads it.
const DOCS = `${home()}/.local/state/herdr-core/default/docs.json`;
const DIR = { row: "right", column: "down" };
const ROW = 32;
// A reopened terminal carries a `reopened-from.<address>=1` label per address it replaces, so an agent holding one finds it with `hc ls --label`.
const FROM = "reopened-from.";
// Labels that belong to the old terminal, not to its work.
const DROP = new Set(["archive", "archived", "hibernate", "resume.shell"]);
// image() blurs these one-color 1em SVGs; svg() draws them crisp in their brand color.
const BRAND = { "icons/claude.svg": "#D97757", "icons/amp.svg": "#F34E3F", "icons/kiro.svg": "#9046FF", "icons/codex.svg": "#7A9DFF" };
const GLYPH = { "icons/codex.svg": "mods/tree/codex.svg" };

const leaves = (n) => (n.type === "block" ? [n] : (n.children ?? []).flatMap(leaves));
const term = (n) => leaves(n).find((b) => b.content?.terminal)?.content?.terminal;
const row = (list) => ({ type: "row", children: list.map((t) => ({ type: "block", content: { terminal: t } })) });
const own = (l) => Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith("herdr.") && !k.startsWith(FROM) && !DROP.has(k)));
const quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;
const records = () => /** @type {any[]} */ (shared(RECORDS) ?? []);

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
  if (!info?.icon) return div().size(14).flex_none();
  const tint = info.tint ? color : BRAND[info.icon];
  return tint ? svg(GLYPH[info.icon] ?? info.icon).size(14).flex_none().text_color(tint) : image(info.icon).w(14).h(14).flex_none();
}

// Claude's "※ recap" line, else its last reply (not a tool step), with its wrapped lines joined.
const STEP = /^(\w+\(|(Read|Reading|Search|Searched|Searching|Wrote|Writing|Update|Updated|Edit|Edited|Ran|Running|List|Listed|Fetch|Fetched|Called)\b)/;
function recapOf(screen) {
  const lines = screen.split("\n");
  for (const mark of ["※ recap:", "⏺"]) {
    const ok = (l) => l.trimStart().startsWith(mark) && !(mark === "⏺" && STEP.test(l.trimStart().slice(mark.length).trim()));
    let i = lines.length - 1;
    while (i >= 0 && !ok(lines[i])) i--;
    if (i < 0) continue;
    const parts = [lines[i].trimStart().slice(mark.length)];
    for (let j = i + 1; j < lines.length && /^\s{2,}[^\s⎿]/.test(lines[j]); j++) parts.push(lines[j]);
    const text = parts.join(" ").replace(/\s+/g, " ").replace(/\s*\(turn off recaps.*$/, "").trim();
    if (text) return text.slice(0, 400);
  }
  return null;
}

// Neighbouring named spaces with the same name are one group, as the tree groups them.
function groups(list) {
  const runs = [];
  for (const s of list) {
    const head = runs.at(-1)?.[0];
    if (head && s.named && head.named && s.name === head.name && (s.machine ?? null) === (head.machine ?? null)) runs.at(-1).push(s);
    else runs.push([s]);
  }
  return runs;
}

export default class Restore extends View {
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
    this.closing = new Set(); // record ids whose close is under way
    this.building = new Set(); // record ids being built back
    if (checking()) return;
    // A restore cut short by a quit or crash keeps what it built and retries the rest on the next cmd-.
    const list = records();
    if (list.some((r) => r.state === "restoring")) setShared(RECORDS, list.map((r) => (r.state === "restoring" ? { ...r, state: "closed" } : r)));
    cx.timer.every(500, (cx) => {
      this.watch();
      this.reread(cx);
    });
    cx.timer.every(1000, (cx) => this.tend(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "reopen") await this.reopen(cx);
        if (c === "work") this.work(cx);
      }
    });
  }

  closed() {
    return /** @type {any[]} */ (shared(CLOSED) ?? []);
  }

  // Space ids a record holds: live ones waiting to close, and ones built back but not yet shown.
  held() {
    return new Set(records().flatMap((r) => r.spaces.map((s) => s.done ?? s.id)));
  }

  update(id, patch) {
    setShared(RECORDS, records().map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
          const t = ts.get(p.terminal);
          const l = t?.labels ?? {};
          return [p.terminal, {
            terminal: p.terminal, cwd: p.cwd, title: p.title || p.program?.name || "shell", icon: p.program?.icon ?? null, tint: Boolean(p.program?.tint),
            session: l["resume.session"] || null, sessionCwd: l["resume.cwd"] || null, flags: l["resume.flags"] || "", codex: l["codex.session"] || null, from: Object.keys(l).filter((k) => k.startsWith(FROM)).map((k) => k.slice(FROM.length)),
            program: p.program?.name ?? null, branch: p.branch ?? null, claude: t?.report?.app === "claude-code", status: p.status ?? null, labels: own(l),
          }];
        }));
        const tree = this.trees.get(tab.id);
        const fits = Boolean(tree) && leaves(tree).map((b) => b.id).join() === mine.map((p) => p.pane).join();
        return { id: tab.id, name: tab.named ? tab.name : null, index: tab.index, active: tab.active, fits, root: fits ? tree : row(Object.keys(info)), info };
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
  // their own tabs in the background leave nothing to reopen. An archive's
  // spaces have their own record.
  lost(before, now, at) {
    const kept = new Set(now.flatMap((s) => s.tabs.flatMap((t) => Object.keys(t.info))));
    const held = this.held();
    const found = [];
    const add = (e) => found.push({ id: `${at}-${found.length}`, closed: at, seen: at, ...e });
    for (const s of before) {
      if (held.has(s.id)) continue;
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

  // The tree's requests, one at a time.
  work(cx) {
    const q = /** @type {any[]} */ (shared(QUEUE) ?? []);
    if (!q.length) return;
    setShared(QUEUE, []);
    for (const op of q) {
      if (op.op === "archive") this.archive(op.ids);
      if (op.op === "cancel") this.cancel(op.record);
      // One build at a time, so each knows which terminals it made.
      if (op.op === "unarchive") this.chain = (this.chain ?? Promise.resolve()).then(() => this.unarchive(cx, op.record));
    }
  }

  // The record is written at once, so it outlives a reboot that lands before the close.
  archive(ids) {
    const held = this.held();
    const now = this.snapshot().filter((s) => ids.includes(s.id) && !held.has(s.id));
    if (!now.length) return;
    const rec = { id: `${Date.now()}-${now[0].id}`, name: now[0].name, at: Date.now(), state: "pending", quiet: 0, needs: null, wait: null,
      spaces: now.map((s) => ({ id: s.id, done: null, repo: null, tabs: s.tabs })) };
    setShared(RECORDS, [rec, ...records()]);
    this.repos(rec);
  }

  // The repo each space's card names, as the tree finds it.
  repos(rec) {
    for (const s of rec.spaces) {
      const cwd = s.tabs.flatMap((t) => Object.values(t.info))[0]?.cwd;
      if (!cwd) continue;
      exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd }).then((r) => {
        if (r.code !== 0) return;
        const dir = r.stdout.trim().replace(/\/+$/, "");
        const repo = dir.endsWith("/.git") ? dir.slice(0, -5).split("/").pop() : dir.split("/").pop().replace(/\.git$/, "");
        const cur = records().find((x) => x.id === rec.id);
        if (cur) this.update(rec.id, { spaces: cur.spaces.map((x) => (x.id === s.id ? { ...x, repo } : x)) });
      }, () => {});
    }
  }

  // A pending group back to the active view, on the space that needs you, else its first.
  cancel(id) {
    const rec = records().find((r) => r.id === id);
    if (!rec || rec.state !== "pending") return;
    setShared(RECORDS, records().filter((r) => r.id !== id));
    const ids = rec.spaces.map((s) => s.id);
    for (const key of LEGACY) {
      const old = /** @type {string[] | undefined} */ (shared(key));
      if (old?.some((x) => ids.includes(x))) setShared(key, old.filter((x) => !ids.includes(x)));
    }
    const needs = rec.needs && terminals().find((t) => t.address === rec.needs)?.labels?.["herdr.space"];
    setShared(VIEW, null);
    run("space.select", { id: needs && ids.includes(needs) ? needs : ids[0] });
  }

  // Each second: archive what the tree archived before records, then close
  // every pending group that has been quiet long enough with a full record.
  tend(cx) {
    if (!this.read.at) return;
    const live = this.snapshot();
    const held = this.held();
    const legacy = new Set(LEGACY.map((k) => /** @type {string[] | undefined} */ (shared(k))).find(Boolean) ?? []);
    for (const group of groups(spaces().filter((s) => legacy.has(s.id) && !held.has(s.id)))) this.archive(group.map((s) => s.id));
    for (const rec of records()) {
      if (rec.state !== "pending" || this.closing.has(rec.id)) continue;
      const mine = live.filter((s) => rec.spaces.some((x) => x.id === s.id));
      if (!mine.length) {
        this.update(rec.id, { state: "closed" });
        continue;
      }
      const infos = mine.flatMap((s) => s.tabs.flatMap((t) => Object.values(t.info)));
      const claude = infos.filter((p) => p.claude);
      const needs = claude.find((p) => p.status === "blocked")?.terminal ?? null;
      const resting = claude.every((p) => p.status === "idle" || p.status === "done");
      const shown = mine.some((s) => s.active);
      const quiet = resting && !needs && !shown ? rec.quiet + 1 : 0;
      const unfit = mine.find((s) => s.tabs.some((t) => !t.fits));
      const nosession = claude.find((p) => !p.session);
      const wait = unfit ? "reading its splits" : nosession ? `waiting for ${nosession.terminal}'s session` : null;
      const fresh = rec.spaces.map((x) => {
        const s = mine.find((m) => m.id === x.id);
        return s ? { ...x, tabs: s.tabs } : x;
      });
      const next = { ...rec, quiet, needs, wait, spaces: fresh };
      if (JSON.stringify(next) !== JSON.stringify(rec)) this.update(rec.id, { quiet, needs, wait, spaces: fresh });
      if (quiet >= QUIET && !wait) cx.spawn(async () => this.close(rec.id));
    }
  }

  async close(id) {
    this.closing.add(id);
    try {
      const rec = records().find((r) => r.id === id);
      if (!rec) return;
      const ids = new Set(rec.spaces.map((s) => s.id));
      // Where each Claude left off, read before its screen goes with it.
      const notes = {};
      for (const t of terminals().filter((t) => ids.has(t.labels?.["herdr.space"]) && t.state === "live" && t.report?.app === "claude-code")) {
        const screen = (await hc(["read", t.address, "--lines", "60"])).stdout ?? "";
        const got = JSON.parse((await hc(["get", t.address, "--json"])).stdout || "{}");
        notes[t.address] = { recap: recapOf(screen), active: got.status_ms ?? null };
      }
      const addresses = terminals().filter((t) => ids.has(t.labels?.["herdr.space"]) && t.state === "live").map((t) => t.address);
      for (const a of addresses) await hc(["label", a, "archived=1"]);
      // A cancel, a turn or a look can land during those awaits.
      const now = records().find((r) => r.id === id);
      const all = spaces();
      if (!now || now.state !== "pending" || now.quiet < QUIET || all.some((s) => ids.has(s.id) && s.active)) {
        for (const a of addresses) hc(["label", a, "archived="]);
        return;
      }
      for (const s of now.spaces) if (all.some((x) => x.id === s.id)) run("space.close", { id: s.id, confirmed: true });
      const noted = now.spaces.map((s) => ({ ...s, tabs: s.tabs.map((tab) => ({ ...tab, info: Object.fromEntries(Object.entries(tab.info).map(([k, v]) => [k, notes[k] ? { ...v, ...notes[k] } : v])) })) }));
      this.update(id, { state: "closed", quiet: 0, needs: null, wait: null, closedAt: Date.now(), spaces: noted });
    } finally {
      this.closing.delete(id);
    }
  }

  // Built out of sight in record order, each space marked done as it lands,
  // then shown once its first Claude is ready if the archive still has it
  // selected. A space that fails to build stays in the record for the next try.
  async unarchive(cx, id) {
    const rec = records().find((r) => r.id === id);
    if (!rec || rec.state !== "closed" || this.building.has(id)) return;
    this.building.add(id);
    this.update(id, { state: "restoring" });
    this.made = [];
    let failed = null;
    try {
      for (const s of rec.spaces) {
        if (s.done && spaces().some((x) => x.id === s.done)) continue;
        const made = await this.rebuild(cx, s, rec.name);
        if (!made) {
          failed = s.repo ?? rec.name ?? "a space";
          break;
        }
        const cur = records().find((r) => r.id === id);
        this.update(id, { spaces: cur.spaces.map((x) => (x.id === s.id ? { ...x, done: made } : x)) });
      }
      if (failed) return;
      const lead = this.made.find((m) => m.session);
      if (lead) await until(cx, () => ["idle", "done"].includes(panes().find((p) => p.terminal === lead.address)?.status), READY);
      const done = records().find((r) => r.id === id);
      const first = done?.spaces[0]?.done;
      const pin = /** @type {{ view: string, at: string | null } | undefined} */ (shared(VIEW));
      const shown = spaces().find((s) => s.active)?.id ?? null;
      const selected = records().find((r) => r.id === shared(SELECTED))?.id ?? records()[0]?.id;
      const watching = pin?.view === "archive" && pin.at === shown && selected === id;
      setShared(RECORDS, records().filter((r) => r.id !== id));
      if (watching && first) {
        setShared(VIEW, null);
        run("space.select", { id: first });
      } else notify({ title: `${rec.name ?? "archived space"} is back`, level: "success" });
      const live = new Set(terminals().filter((t) => t.state === "live").map((t) => t.address));
      const ended = this.made.filter((m) => m.session && !live.has(m.address)).map((m) => m.address);
      if (ended.length) notify({ title: "Claude did not resume", body: ended.join(", "), level: "error" });
    } finally {
      this.building.delete(id);
      this.made = null;
      if (records().find((r) => r.id === id)?.state === "restoring") this.update(id, { state: "closed" });
      if (failed) notify({ title: `could not unarchive ${rec.name ?? "the group"}`, body: `${failed} did not build; cmd-. tries the rest again`, level: "error" });
    }
  }

  // Nothing takes focus: the space and its tabs open in the background,
  // splits come off a named pane, and a split's new shell is told what to run.
  async rebuild(cx, s, name) {
    const [first, ...others] = s.tabs;
    const l = launch(first.info[term(first.root)]);
    if (l.folder) await exec("mkdir", ["-p", l.folder]);
    const was = new Set(spaces().map((x) => x.id));
    run("space.new", { ...(name ? { name } : {}), ...(first.name ? { tab: first.name } : {}), folder: l.folder, ...(l.argv ? { argv: l.argv } : {}), focus: false });
    const made = await until(cx, () => spaces().find((x) => !was.has(x.id) && x.tabs.length), LONG);
    if (!made) return null;
    await this.fill(cx, first, made.tabs[0].id, true);
    for (const tab of others) await this.tab(cx, made.id, tab, true);
    return made.id;
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

  async open(cx, pane, info, place, tab, hidden = false) {
    if (!pane) return null;
    const before = new Set(panes().map((p) => p.pane));
    if (hidden) {
      const l = launch(info);
      if (l.folder) await exec("mkdir", ["-p", l.folder]);
      run("pane.split", { direction: place, pane });
    } else {
      run("pane.focus", { pane });
      run("terminal.open", { ...launch(info), place });
    }
    const made = (await until(cx, () => panes().find((p) => p.tab === tab && !before.has(p.pane)), hidden ? LONG : 1000))?.pane ?? null;
    if (!made) return null;
    const address = await this.mark(cx, made, info);
    if (hidden && address) {
      const l = launch(info);
      const line = [l.folder ? `cd ${quote(l.folder)}` : null, l.argv?.join(" ")].filter(Boolean).join(" && ");
      if (line) await hc(["send", address, line]);
    }
    return made;
  }

  // Back with its labels, and named after every address it replaces.
  async mark(cx, pane, info) {
    const address = await until(cx, () => panes().find((p) => p.pane === pane)?.terminal);
    if (!address) return null;
    const from = [...(info?.from ?? []), info?.terminal].filter(Boolean).slice(-5);
    const labels = [...Object.entries(info?.labels ?? {}).map(([k, v]) => `${k}=${v}`), ...from.map((a) => `${FROM}${a}=1`)];
    if (labels.length) await hc(["label", address, ...labels]);
    this.made?.push({ address, session: Boolean(info?.session) });
    return address;
  }

  async tab(cx, space, tab, hidden = false) {
    const was = new Set(spaces().find((s) => s.id === space)?.tabs.map((t) => t.id));
    const l = launch(tab.info[term(tab.root)]);
    if (hidden && l.folder) await exec("mkdir", ["-p", l.folder]);
    run("tab.new", { space, ...(tab.name ? { name: tab.name } : {}), folder: l.folder, ...(l.argv ? { argv: l.argv } : {}), ...(hidden ? { focus: false } : {}) });
    const made = await until(cx, () => spaces().find((s) => s.id === space)?.tabs.find((t) => !was.has(t.id)), hidden ? LONG : 1000);
    if (!made) return;
    if (!hidden) run("tab.move", { id: made.id, index: tab.index });
    await this.fill(cx, tab, made.id, hidden);
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

  async fill(cx, tab, id, hidden = false) {
    const pane = await until(cx, () => panes().find((p) => p.tab === id), hidden ? LONG : 1000);
    if (!pane) return;
    await this.mark(cx, pane.pane, tab.info[term(tab.root)]);
    await this.build(cx, tab.root, pane.pane, tab.info, id, hidden);
  }

  // Lays a split out from the pane holding its first leaf: its other
  // children are split off one after another, sized, then built in turn.
  // Mod panes aren't rebuilt.
  async build(cx, node, pane, info, tab, hidden = false) {
    if (node.type === "block") return;
    const kids = (node.children ?? []).filter((c) => info[term(c)]);
    const slots = [pane];
    for (let k = 1; k < kids.length; k++) {
      const made = await this.open(cx, slots[k - 1], info[term(kids[k])], DIR[node.type], tab, hidden);
      if (!made) return;
      slots.push(made);
    }
    for (let k = 0; k < kids.length; k++) {
      resize(slots[k], kids[k].size);
      await this.build(cx, kids[k], slots[k], info, tab, hidden);
    }
  }

  pick(e) {
    closeOverlay(this.overlay);
    if (!e) return;
    setShared(PICK, e.id);
    run("restore.reopen");
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
        .when(Boolean(lead?.terminal), (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.accent + "26").font_family("JetBrains Mono").text_size(11).font_semibold().text_color(t.accent)
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
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("recently closed")).child(h_flex().gap(4).items_center().text_size(11).text_color(t.dim)
        .child(div().text_color(t.muted).child("↵")).child(div().child("reopen"))
        .child(div().id("rc-esc").ml(8).px(6).py(2).rounded(5).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => closeOverlay(this.overlay)).child("esc"))))
      .child(v_flex().id("rc-list").flex_1().min_h(0).overflow_y_scroll().pb(6)
        .when(!list.length, (el) => el.child(div().p(10).text_color(t.dim).child("nothing closed yet")))
        .children(list.map(line)));
  }
}
