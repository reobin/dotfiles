// One sidebar list: every space, its tabs, their panes. Each space is a card,
// the shown one outlined, in an outlined box that a group of spaces shares. An
// agent pane gets a row with its icon, session title and status; any other
// pane is a chip with its address and program, and a tab with no agent folds
// to one line of chips. Only what needs you is marked. Under 160px wide,
// spaces only. A group archives and moves as one. Active spaces and the
// archive are two views: only one draws, and a footer names it and offers the
// other (space-nav walks one view at a time). The archive lists the restore
// mod's records, one row per group, while the empty-view block shows the
// selected one over the panes; cmd-. there unarchives it. The view is the
// shown space's, except that alt-. into the archive, closing or archiving the
// last active space, or hopping into an empty view, holds it until another
// space is shown. The archive is marked beside the traffic lights and on the
// footer's top edge.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { mark } from "./marks.js";
import { spaces, panes, terminals, run, theme, layout, shared, setShared, openOverlay, exec, hc, nextCommand, window, settings } from "herdr";

const MONO = "JetBrains Mono";
const SANS = "Geist";
const ARCHIVED = "tree.archived";
// Read until the first archive toggle writes ARCHIVED; space-nav reads it the same way.
const LEGACY = "tree.collapsed";
// { view: "open" | "archive", at }: the view held while the space at is shown. space-nav reads it the same way.
const VIEW = "tree.view";
// The empty view shown in place of the panes ("open" | "archive"), or null; empty-view and status-tabs read it.
const EMPTY = "tree.empty";
// The restore mod's archive (see its RECORDS), the requests sent to it, and the
// record the archive view shows. space-nav and empty-view read them the same way.
const RECORDS = "restore.records";
const QUEUE = "restore.queue";
const SELECTED = "archive.selected";
const records = () => /** @type {any[]} */ (shared(RECORDS) ?? []);
const selectedRecord = () => records().find((r) => r.id === shared(SELECTED)) ?? records()[0] ?? null;
// { record, i }: the space within the selected group that cmd-i, cmd-g and the top bar follow; status-tabs, status-panel, space-nav and empty-view read it.
const SPACE = "archive.space";
const spaceIndex = (r) => { const s = /** @type {any} */ (shared(SPACE)); return s?.record === r?.id ? Math.min(s.i, r.spaces.length - 1) : 0; };
function send(op) {
  setShared(QUEUE, [...(/** @type {any[]} */ (shared(QUEUE) ?? [])), op]);
  run("restore.work");
}
const TICKET = /^[A-Za-z][A-Za-z0-9]{1,4}-\d{1,6}$/;
const PR = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)$/;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
function ago(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}
// The block is a window drag handle; this keeps the list clear of the traffic
// lights and level with the pane's top (30px tab bar + 8px padding).
const TOP = 38;
// Agent rows and tool chips share one height, so a pane row is the same size either way.
const ROW = 26;
const SLACK = 8;
const icon = (name) => svg(`mods/tree/${name}.svg`);
const zoomMark = (t) => h_flex().flex_none().px(3).h(16).items_center().rounded(5).bg(t.accent + "26").text_color(t.accent).child(icon("zoomed").size(11));
// image() rasterizes these 1em SVGs small and scales them up into a blurry fringe;
// they are one color, so svg() can draw them crisp in that color.
const BRAND = { "icons/claude.svg": "#D97757", "icons/amp.svg": "#F34E3F", "icons/kiro.svg": "#9046FF", "icons/codex.svg": "#7A9DFF" };
// The app's codex icon is its mark on a white tile; draw the mark alone.
const GLYPH = { "icons/codex.svg": "mods/tree/codex.svg" };
const isAgent = (p) => Boolean(p.program?.agent);
// A tab whose content fits on its label's line: no agent at all, or one agent alone.
const quiet = (list) => list.length > 0 && !list.some(isAgent);
const solo = (list) => (list.length === 1 && isAgent(list[0]) ? list[0] : null);

// The ticket and PR the top bar shows for the space, from status-tabs' cache;
// a space it hasn't looked up lately shows only what its labels name.
// What to type for a terminal: its address's last two characters, more while another pane's address ends the same way.
function shorthand(address) {
  const local = (a) => a.split("/").pop();
  const me = local(address);
  const others = panes().map((p) => p.terminal).filter((a) => a && a !== address).map(local);
  let n = 2;
  while (n < me.length - 1 && others.some((o) => o.endsWith(me.slice(-n)))) n++;
  return [address.slice(0, -n), address.slice(-n)];
}

function work(s, ps, terms) {
  const mine = ps.filter((p) => p.terminal && s.tabs.some((tab) => tab.id === p.tab));
  const first = mine.find((p) => p.tab === s.tabs[0]?.id);
  const prOf = (p) => /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)$/.exec(terms.get(p?.terminal)?.labels?.pr ?? "");
  const ticketOf = (p) => {
    const id = terms.get(p?.terminal)?.labels?.ticket;
    return /^[A-Za-z][A-Za-z0-9]{1,4}-\d{1,6}$/.test(id ?? "") ? id : null;
  };
  const active = s.tabs.find((tab) => tab.active);
  const focus = mine.find((p) => p.focused) ?? mine.find((p) => p.tab === active?.id);
  const pane = focus && (prOf(focus) || ticketOf(focus) || focus.branch) ? focus : first;
  const pr = prOf(pane);
  const ticket = ticketOf(pane);
  const cwd = first?.cwd || s.folder || null;
  const branch = pane === first ? first?.branch || s.branch || null : pane?.branch;
  // Keep selection and the cache key in sync with status-tabs/status.js target(); mods cannot import across folders.
  const entry = shared("status-tabs.work")?.[[s.id, ticket, pr?.[0] ?? null, branch, pane?.cwd || cwd].join("|")];
  return { ticket: entry?.ticket ?? (ticket ? { id: ticket } : null), pr: entry?.pr ?? (pr ? { number: pr[1] } : null) };
}

// Icons and colours as status-tabs/status.js draws them in the top bar.
const ICONS = "data/status-tabs/icons";
const STARTED_MAX = 12;

function ticketLook(t, ticket) {
  const state = ticket.issue?.state;
  if (!state) return ["lin-unknown", t.dim];
  if (state.type !== "started") return [{ backlog: "lin-backlog", triage: "lin-backlog", unstarted: "lin-todo", completed: "lin-done", canceled: "lin-canceled" }[state.type] ?? "lin-todo", state.color];
  const started = (ticket.issue.team?.states?.nodes ?? []).filter((x) => x.type === "started").sort((a, b) => a.position - b.position);
  const i = started.findIndex((x) => x.id === state.id), d = started.length + 1;
  const icon = i < 0 ? "lin-started-1-2" : d <= STARTED_MAX ? `lin-started-${i + 1}-${d}`
    : `lin-started-${Math.min(STARTED_MAX - 1, Math.max(1, Math.round(((i + 1) / d) * STARTED_MAX)))}-${STARTED_MAX}`;
  return [icon, state.color];
}

// Open: whether it can merge (green ready, yellow waiting, red needs fixing).
function prLook(t, pr) {
  const icon = { merged: "pr-merged", closed: "pr-closed", draft: "pr-draft" }[pr.state] ?? "pr";
  if (pr.state !== "open") return [icon, { merged: t.ansi5, closed: t.ansi1 }[pr.state] ?? t.dim];
  const { ok, reasons = [] } = pr.merge ?? {};
  const broken = reasons.some((r) => r.startsWith("conflicts") || r.endsWith("failing") || r === "changes requested");
  return [icon, ok ? t.ansi2 : ok === false ? broken ? t.ansi1 : t.ansi3 : t.dim];
}

// self_baseline() lands small text low on the space row; centred, it sits
// about 1px above the repo's baseline, so pt(2) drops it that pixel.
const tag = (t, [name, color], text) => h_flex().flex_none().pt(2).gap(3).items_center()
  .child(svg(`${ICONS}/${name}.svg`).size(12).flex_none().text_color(color))
  .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(text));

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const sectionOf = (archived, id) => (archived.has(id) ? "archive" : "open");

// Keep in sync with space-nav's view().
function viewOf(all, archived) {
  const now = all.find((s) => s.active)?.id ?? null;
  const pin = /** @type {{ view: string, at: string | null } | undefined} */ (shared(VIEW));
  if (pin && pin.at === now) return pin.view;
  return now ? sectionOf(archived, now) : "open";
}

const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// The archive's colour is the theme's own magenta, so every theme marks it its way.
const archiveInk = (t) => t.ansi5;

// Where the strip beside the traffic lights starts; with no buttons drawn there
// (fullscreen, other platforms), the sidebar's own edge. Same sum as status-tabs.
function afterLights() {
  const w = window(), root = /** @type {any} */ (layout());
  return w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
    ? (root.traffic_lights[0] + 64) / settings().zoom
    : 16;
}

// Idle says nothing: a mark means work is running or waiting on you.
const status = (t, st) => mark(t, st);

const RANK = { working: 1, done: 2, blocked: 3 };
function worst(t, list) {
  const st = list.map((p) => p.status).filter((x) => RANK[x]).sort((a, b) => RANK[b] - RANK[a])[0];
  return st ? status(t, st) : null;
}

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s, ps) {
  const tabs = new Set(s.tabs.map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);

// Neighbouring named spaces with the same name group; each section keeps
// space order, so it stays in alt-j/k order. Unnamed names follow folders,
// so they never group.
function sets(list) {
  const runs = [];
  for (const s of list) {
    const head = runs.at(-1)?.[0];
    if (head && s.named && head.named && s.name === head.name && (s.machine ?? null) === (head.machine ?? null)) runs.at(-1).push(s);
    else runs.push([s]);
  }
  return runs;
}

// The press stops at the row so it doesn't drag the window, and at a chip so
// the tab line under it doesn't act too.
function press(el, act) {
  return el
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_mouse_up("left", (_e, cx) => {
      cx.stop_propagation();
      act();
    });
}

export default class Tree extends View {
  init(_props, cx) {
    this.repo = {}; // where() -> the main checkout's folder name, null: not a repo
    this.asking = false;
    this.hot = null; // "space-<id>" or "tab-<id>": its whole card or block lights up
    this.under = null; // { key, at }: the lit row the last move over one landed on
    this.at = null; // where the last move over the sidebar landed, null once it leaves
    this.scroll = ScrollHandle.new();
    this.archiveScroll = ScrollHandle.new();
    this.revealed = null;
    this.applying = new Set(); // terminal addresses whose archive label is being cleared
    cx.timer.every(1000, (cx) => {
      this.lookup(cx);
      this.requests();
    });
    this.lookup(cx);
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "space-up") this.move(-1);
        if (c === "space-down") this.move(1);
        if (c === "toggle-archive") this.toggle();
        if (c === "close-space") this.closeSpace();
      }
    });
  }

  // Live spaces out of the active view: ones archived before records (restore
  // turns them into records), and a record's while it waits to close or is
  // built back, including ones just sent to restore.
  archived() {
    const ids = new Set(/** @type {string[]} */ (shared(ARCHIVED) ?? shared(LEGACY) ?? []));
    for (const r of records()) for (const s of r.spaces) ids.add(s.done ?? s.id);
    for (const op of /** @type {any[]} */ (shared(QUEUE) ?? [])) for (const id of op.ids ?? []) ids.add(id);
    return ids;
  }

  // The groups on one side of the hairline: the one the space id is on.
  side(all, archived, id) {
    return sets(all.filter((s) => archived.has(s.id) === archived.has(id)));
  }

  // In the archive, the selected group: one still finishing its turn comes
  // back at once, a closed one is built back. Elsewhere, the shown space's group.
  toggle() {
    if (viewOf(spaces(), this.archived()) !== "archive") return this.archive(spaces().find((s) => s.active)?.id);
    const r = selectedRecord();
    if (r?.state === "pending") send({ op: "cancel", record: r.id });
    else if (r?.state === "closed") send({ op: "unarchive", record: r.id });
  }

  // Agents can't pass a space id to a mod command, so they label one of the
  // space's terminals archive=1 (or archive=0 to take back an archive that
  // hasn't closed yet); the label is cleared once applied. Only the user
  // unarchives a closed group.
  requests() {
    for (const term of terminals()) {
      const want = term.labels?.archive;
      const space = term.labels?.["herdr.space"];
      if ((want !== "1" && want !== "0") || !space || this.applying.has(term.address)) continue;
      const id = term.machine ? `${term.machine}/${space}` : space;
      if (want === "1") this.archive(id);
      else {
        const r = records().find((x) => x.state === "pending" && x.spaces.some((s) => s.id === id));
        if (r) send({ op: "cancel", record: r.id });
      }
      this.applying.add(term.address);
      hc(["label", term.address, "archive="]).finally(() => this.applying.delete(term.address));
    }
  }

  // A space archives with its whole group: restore records it and closes it
  // once its Claudes are quiet. The view moves on to the next active space.
  archive(id) {
    const all = spaces();
    const was = this.archived();
    if (!id || !all.some((s) => s.id === id) || was.has(id)) return;
    const group = this.side(all, was, id).find((r) => r.some((s) => s.id === id)) ?? [];
    send({ op: "archive", ids: group.map((s) => s.id) });
    if (!group.some((s) => s.active)) return;
    const ids = new Set(group.map((s) => s.id));
    const open = all.filter((s) => !was.has(s.id) || ids.has(s.id));
    const i = open.findIndex((s) => ids.has(s.id));
    const next = open[i + group.length] ?? open[i - 1];
    if (next) run("space.select", { id: next.id });
  }

  // The shown space's group moves as one, past the whole group next to it on
  // its side of the hairline. space.move stays inside its machine's block, so
  // stop at its edge.
  move(step) {
    const all = spaces();
    const id = all.find((s) => s.active)?.id;
    if (!id) return;
    const runs = this.side(all, this.archived(), id);
    const i = runs.findIndex((r) => r.some((s) => s.id === id));
    const mine = runs[i];
    const other = runs[i + step];
    if (!other || (other[0].machine ?? null) !== (mine[0].machine ?? null)) return;
    const ids = new Set(mine.map((s) => s.id));
    const rest = all.map((s) => s.id).filter((x) => !ids.has(x));
    const at = step > 0 ? rest.indexOf(other.at(-1).id) + 1 : rest.indexOf(other[0].id);
    const want = [...rest.slice(0, at), ...mine.map((s) => s.id), ...rest.slice(at)];
    // Each move lands against the order the ones before it left.
    const order = all.map((s) => s.id);
    want.forEach((x, k) => {
      if (order[k] === x) return;
      order.splice(order.indexOf(x), 1);
      order.splice(k, 0, x);
      run("space.move", { id: x, index: k + 1 });
    });
  }

  // A worktree's own folder is often named after its branch; the shared git
  // dir names the repo.
  lookup(cx) {
    const ps = panes();
    const todo = [...new Set(spaces().map((s) => where(s, ps)))].filter((k) => !(k in this.repo) && JSON.parse(k)[1]);
    if (this.asking || !todo.length) return;
    this.asking = true;
    cx.spawn(async (cx) => {
      for (const k of todo) {
        const [on, cwd] = JSON.parse(k);
        try {
          const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
          const dir = r.stdout.trim().replace(/\/+$/, "");
          this.repo[k] = r.code !== 0 ? null : dir.endsWith("/.git") ? dir.slice(0, -5).split("/").pop() : dir.split("/").pop().replace(/\.git$/, "");
        } catch {
          this.repo[k] = null;
        }
      }
      this.asking = false;
      cx.notify();
    });
  }

  repoOf(s, ps) {
    return (this.repo[where(s, ps)] ?? (s.named ? place(s, ps).split("/").pop() : s.name)) || s.name;
  }

  // A folded space keeps its pane count and its status, so what needs you still shows.
  // The repo leads and the ticket and PR sit at the right edge, where the
  // task's name sits above them on the outline. same: the card above in the
  // group shows this ticket, so this one leaves it out.
  space(t, s, ps, terms, folded, same) {
    const { ticket, pr } = work(s, ps, terms);
    const tabs = new Set(s.tabs.map((tab) => tab.id));
    const st = folded && s.status && s.status !== "idle" ? status(t, s.status) : null;
    return press(this.lit(h_flex().id(`space-${s.id}`).h(22).flex_none().px(8).gap(8).items_center().rounded(5),
      `space-${s.id}`), () => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(icon("cube").size(14).flex_none().text_color(t.dim))
      .child(div().min_w(0).truncate().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child(this.repoOf(s, ps)))
      .child(div().flex_1())
      .when(Boolean(ticket) && !same, (el) => el.child(tag(t, ticketLook(t, ticket), ticket.id)))
      .when(Boolean(pr), (el) => el.child(tag(t, prLook(t, pr), `#${pr.number}`)))
      .when(folded, (el) => el
        .child(div().flex_none().pt(2).font_family(MONO).text_size(11.5).text_color(t.dim)
          .child(`+${ps.filter((p) => tabs.has(p.tab)).length}`))
        .when(Boolean(st), (el) => el.child(st)));
  }

  // The tab's place and name. A tab with no agent ends there: its panes
  // follow on the same line as chips, with the worst status at the end. A
  // lone agent follows as its row, and the tab name gives way to its title.
  tab(t, s, tab, list) {
    const shown = s.active && tab.active;
    const one = solo(list);
    const st = quiet(list) ? worst(t, list) : null;
    const label = h_flex().flex_none().h(ROW).gap(4).items_center()
      .child(icon("window").size(12).flex_none().text_color(t.dim))
      .child(div().flex_none().font_family(MONO).text_size(11).font_semibold().text_color(shown ? t.foreground : t.muted).child(String(tab.index)))
      .when(tab.named, (el) => el.child(div().min_w(0).max_w(one ? 90 : 140).truncate().text_size(11.5).text_color(t.dim).child(tab.name)));
    // Chips wrap in their own column, so a second line starts under the
    // first chip rather than under the tab icon.
    return press(this.lit(h_flex().id(`tab-${tab.id}`).min_h(ROW).flex_none().px(8).gap(4),
      `tab-${tab.id}`), () => { run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
      .when(!one, (el) => el.items_start())
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: s.id } } }))
      .child(label)
      .when(Boolean(one), (el) => el.child(this.pane(t, s, one, true)))
      .when(quiet(list), (el) => el
        .child(h_flex().flex_1().min_w(0).flex_wrap().gap(4).pl(4)
          .children(list.map((p) => this.chip(t, s, p))))
        .when(Boolean(st), (el) => el.child(h_flex().flex_none().h(ROW).items_center().child(st))));
  }

  label(p) {
    const sign = p.terminal;
    const name = isAgent(p) ? p.title || p.program.name : p.terminal ? p.program?.name ?? "shell" : p.title;
    return [sign, name];
  }

  pill(t, on, sign) {
    const [head, tail] = sign === "·" ? ["", sign] : shorthand(sign);
    return h_flex().flex_none().min_w(28).h(18).px(6).justify_center().items_center().rounded(5)
      .font_family(MONO).text_size(11).font_semibold()
      .bg(on ? t.accent + "26" : t.foreground + "0f").text_color(on ? t.accent : t.muted)
      .child(div().opacity(0.5).child(head)).child(div().child(tail));
  }

  // Any pane that isn't an agent: its address pill, extended to the right by
  // its program, so starting an agent in it leaves the pill where it was.
  chip(t, s, p) {
    const [sign, name] = this.label(p);
    const on = s.active && p.focused;
    const st = status(t, p.status);
    return press(h_flex().id(`pane-${p.pane}`).h(ROW).flex_none().items_center(), () => run("pane.focus", { pane: p.pane }))
      .child(h_flex().h(18).pr(6).gap(8).items_center().rounded(5)
        .bg(t.foreground + "06").hover((x) => x.bg(t.hover))
        .when(Boolean(sign), (el) => el.child(this.pill(t, on, sign)))
        .when(!sign, (el) => el.pl(6))
        .child(div().min_w(0).max_w(140).truncate().text_size(12).text_color(on ? t.foreground : t.muted).child(name ?? ""))
        .when(p.zoomed, (el) => el.child(zoomMark(t)))
        .when(Boolean(st), (el) => el.child(st)));
  }

  // Agents get rows; the rest of the tab gathers in one wrapping line of chips.
  paneList(t, s, list) {
    const tools = list.filter((p) => !isAgent(p));
    return [
      ...list.filter(isAgent).map((p) => this.pane(t, s, p)),
      ...(tools.length ? [h_flex().flex_none().flex_wrap().gap(4).px(8)
        .children(tools.map((p) => this.chip(t, s, p)))] : []),
    ];
  }

  // inline: on its tab's line, it takes the rest of the line instead of a row.
  pane(t, s, p, inline = false) {
    const [sign, name] = this.label(p);
    const agent = p.program?.agent;
    const tint = p.program?.tint ? t.dim : BRAND[p.program?.icon];
    const pic = agent && p.program.icon
      ? tint ? svg(GLYPH[p.program.icon] ?? p.program.icon).size(14).flex_none().text_color(tint) : image(p.program.icon).w(14).h(14).flex_none()
      : null;
    const on = s.active && p.focused;
    const st = status(t, p.status);
    return press(h_flex().id(`pane-${p.pane}`).h(ROW).gap(8).items_center().rounded(5)
      .when(inline, (el) => el.flex_1().min_w(0).pl(4))
      .when(!inline, (el) => el.flex_none().px(8))
      .hover((x) => x.bg(t.hover)), () => run("pane.focus", { pane: p.pane }))
      .child(this.pill(t, on, sign ?? "·"))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().font_family(SANS).text_size(13.5).when(on, (el) => el.font_medium()).text_color(on ? t.foreground : t.muted).child(name))
      .when(p.zoomed, (el) => el.child(zoomMark(t)))
      .when(Boolean(st), (el) => el.child(st));
  }

  // Hovering a space's or tab's title row lights the whole card or tab block,
  // so the row only reports the hover. on_hover misses exits when a row moves
  // or vanishes under a still pointer, or the pointer leaves through a popup,
  // so every move names the row it is over and settle() matches it against
  // the root's view of the same move, whichever handler runs first.
  lit(el, key) {
    return el.on_mouse_move((e, cx) => {
      this.under = { key, at: e.position };
      this.settle(cx);
    });
  }

  settle(cx) {
    const [u, at] = [this.under, this.at];
    const key = u && at && u.at.x === at.x && u.at.y === at.y ? u.key : null;
    if (key === this.hot) return;
    this.hot = key;
    cx.notify();
  }

  rows(t, s, ps, terms, folded, same) {
    if (folded) return [this.space(t, s, ps, terms, true, same)];
    const mine = s.tabs.map((tab) => [tab, ps.filter((p) => p.tab === tab.id)]);
    return [
      this.space(t, s, ps, terms, false, same),
      ...mine.flatMap(([tab, list]) => s.tabs.length > 1
        ? [v_flex().flex_none().mt(4).rounded(5).when(this.hot === `tab-${tab.id}`, (el) => el.bg(t.hover))
          .child(this.tab(t, s, tab, list))
          .children(quiet(list) || solo(list) ? [] : this.paneList(t, s, list))]
        : this.paneList(t, s, list)),
    ];
  }

  // The task's name, when it says something the repo does not, straddles the
  // top edge of its box's outline with its last letter over the ticket and PR,
  // and paints the outline out behind it. It sits in the box's frame, not the
  // box: a border paints over children.
  legend(t, s, ps, ink) {
    if (s.name === this.repoOf(s, ps)) return null;
    // The edge runs through the x-height, where lowercase reads centred, not the line box's middle.
    return h_flex().absolute().top(SLACK - 7).right(13).h(13).px(4).items_center().bg(t.chrome)
      .child(div().font_family(MONO).text_size(11.5).text_color(ink).child(s.name));
  }

  // The shown card's outline takes a pixel of its padding, so nothing shifts
  // when it moves.
  card(t, s, ps, terms, folded, same = false) {
    const pad = s.active ? 1 : 0;
    return v_flex().id(`card-${s.id}`).flex_none().px(4 - pad).pt(4 - pad).pb(4 - pad).rounded(8)
      .bg(this.hot === `space-${s.id}` ? t.hover : s.active ? t.background : t.foreground + "06")
      .when(s.active, (el) => el.border(1).border_color(t.accent + "33"))
      .children(this.rows(t, s, ps, terms, folded, same));
  }

  // A run of neighbouring spaces shares an outlined box, and a lone space gets
  // one of its own. It is drawn as one slice per card so every card is its own
  // list child: scroll_to_item can then reveal the shown card even when its
  // group is taller than the sidebar.
  group(t, run, ps, terms, folded) {
    const last = run.length - 1;
    const ids = run.map((s) => work(s, ps, terms).ticket?.id);
    return run.map((s, i) => v_flex().id(`group-${s.id}`).flex_none().px(4).pt(i === 0 ? 8 : 4).border_x(1)
      .border_color(t.border)
      .when(i === 0, (el) => el.border_t(1).rounded_t(12))
      .when(i === last, (el) => el.pb(4).border_b(1).rounded_b(12))
      .child(this.card(t, s, ps, terms, folded.has(s.id), i > 0 && Boolean(ids[i]) && ids[i] === ids[i - 1])));
  }

  // scroll_to_item stops a child at the list's edge, so each card sits in a
  // clear frame of SLACK above and below; negative margins overlap the frames
  // so the cards keep their spacing. A name on the top edge pokes 6px above
  // it, and every box leaves room for one so naming a space shifts nothing.
  cards(t, runs, ps, terms, folded) {
    return runs.flatMap((run, k) => {
      const name = this.legend(t, run[0], ps, run.some((s) => s.active) ? t.accent : t.muted);
      return this.group(t, run, ps, terms, folded).map((el, i) =>
        v_flex().relative().flex_none().py(SLACK).mt((k > 0 && i === 0 ? 14 : 0) - (k === 0 && i === 0 ? 1 : 2) * SLACK).child(el)
          .when(i === 0 && Boolean(name), (el) => el.child(name)));
    });
  }

  rail(t, runs) {
    return runs.map((run) => {
      const icons = this.icons(t, run);
      return run.length > 1
        ? v_flex().id(`set-${run[0].id}`).flex_none().gap(4).rounded(8).bg(t.foreground + "06").children(icons)
        : icons[0];
    });
  }

  icons(t, list) {
    return list.map((s) => {
      const st = s.status && s.status !== "idle" ? status(t, s.status) : null;
      return press(h_flex().id(`space-${s.id}`).relative().size(32).flex_none().justify_center().items_center().rounded(8)
        .when(s.active, (el) => el.bg(t.background))
        .when(!s.active, (el) => el.hover((x) => x.bg(t.hover))), () => run("space.select", { id: s.id }))
        .child(div().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child([...s.name][0]?.toUpperCase() ?? "?"))
        .when(Boolean(st), (el) => el.child(div().absolute().top(3).right(3).child(st)));
    });
  }

  // Nearest open space to id, below first.
  nearestOpen(order, id, all, archived) {
    const i = order.indexOf(id);
    const open = (x) => all.some((s) => s.id === x) && !archived.has(x);
    return [...order.slice(i + 1), ...order.slice(0, i).reverse()].find(open);
  }

  // Herdr shows the closed space's neighbour, which may be archived, so move
  // to an open one first and close the space from behind. Not close(): that
  // name is the view's teardown hook.
  closeSpace() {
    const all = spaces();
    const archived = this.archived();
    const id = all.find((s) => s.active)?.id;
    if (!id) return;
    const next = archived.has(id) ? null : this.nearestOpen(all.map((s) => s.id), id, all, archived);
    if (next) run("space.select", { id: next });
    run("space.close", { id, confirmed: true });
  }

  // Fallback for closes that skip closeSpace(), like a space's last pane exiting.
  keepOpen(all, archived) {
    const now = all.find((s) => s.active)?.id;
    if (!now) return;
    const [was, order] = [this.shown, this.order];
    this.shown = now;
    this.order = all.map((s) => s.id);
    if (!was || was === now || archived.has(was) || !archived.has(now) || all.some((s) => s.id === was)) return;
    const next = this.nearestOpen(order, was, all, archived);
    if (next) run("space.select", { id: next });
  }

  // The view to draw. When the space last shown was closed, or archived out of
  // the active view it was in, and that left its view empty, the view stays
  // put. A space shown from outside the view (one an empty view is held over)
  // only holds it by closing, so alt-. off the held view isn't undone.
  stay(all, archived) {
    const now = all.find((s) => s.active)?.id ?? null;
    let view = viewOf(all, archived);
    const was = this.was;
    const gone = was?.id && !all.some((s) => s.id === was.id);
    const archivedOut = was?.inView && was.view === "open" && archived.has(was.id);
    if (was?.id && view !== was.view && (gone || archivedOut)
      && !all.some((s) => sectionOf(archived, s.id) === was.view)) {
      setShared(VIEW, { view: was.view, at: now });
      view = was.view;
    }
    this.was = { id: now, view, inView: Boolean(now) && sectionOf(archived, now) === view };
    return view;
  }

  // Brings the shown space's list child into view when the shown space
  // changes, moves or grows, and leaves a hand scroll alone otherwise.
  // items: the spaces each list child holds.
  reveal(handle, items, ps) {
    const i = items.findIndex((run) => run.some((s) => s.active));
    const s = i < 0 ? null : items[i].find((x) => x.active);
    const tabs = new Set(s?.tabs.map((tab) => tab.id));
    const key = s ? `${s.id}:${i}:${s.tabs.length}:${ps.filter((p) => tabs.has(p.tab)).length}` : null;
    if (key === this.revealed) return;
    this.revealed = key;
    if (i >= 0) handle.scroll_to_item(i);
  }

  // The view you are in, with its count, and a button for the other one with
  // its count and what in it needs you. Its hairline runs to the pane, which
  // sits flush with the sidebar, and takes the archive's colour in the archive.
  footer(t, here, other, marks, inArchive) {
    const count = (n) => String(n);
    const name = (archived) => (archived ? "archived" : "active");
    const hop = () => run("space-nav.switch");
    return v_flex().id("footer").flex_none()
      .child(div().flex_none().border_t(inArchive ? 2 : 1).border_color(inArchive ? archiveInk(t) : t.dim + "80"))
      .child(h_flex().h(40).pl(16).pr(8).gap(8).items_center().font_family(MONO).text_size(11.5).text_color(t.muted)
        .child(div().flex_none().text_size(10.5).font_semibold().text_color(inArchive ? archiveInk(t) : t.foreground).child(name(inArchive)))
        .child(div().flex_none().text_color(t.dim).child(count(here)))
        .child(div().flex_1())
        .child(press(h_flex().id("footer-hop").flex_none().h(26).px(10).gap(8).items_center().rounded(7)
          .bg(t.foreground + "06").hover((x) => x.bg(t.hover)), hop)
          .child(h_flex().gap(6).items_center().child(div().child(name(!inArchive))).child(div().text_color(t.dim).child(count(other))))
          .when(marks.length > 0, (el) => el.child(h_flex().gap(3).items_center().children(marks)))
          .child(div().opacity(0.6).text_size(10.5).child("alt-."))));
  }

  // An archived space's ticket and PR state, as status-tabs caches it for its standIn(); keep the key in sync.
  archivedWork(r, i) {
    const infos = r.spaces[i].tabs.flatMap((tab) => Object.values(tab.info));
    const lead = infos.find((p) => p.labels?.pr || p.labels?.ticket) ?? infos[0] ?? {};
    const ticket = TICKET.test(lead.labels?.ticket ?? "") ? lead.labels.ticket : null;
    const pr = PR.test(lead.labels?.pr ?? "") ? lead.labels.pr : null;
    const key = [`archived:${r.id}:${i}`, ticket, pr, lead.branch ?? null, lead.sessionCwd || lead.cwd || null].join("|");
    return shared("status-tabs.work")?.[key] ?? null;
  }

  // Archived groups drawn like active ones, from their records: a box per
  // group with its name on the outline, a card per space with its repo, ticket
  // and PR, the selected group outlined. Under the last card, how long ago it
  // left, and why while it's still open.
  records(t, recs, on) {
    const labelsOf = (s) => s.tabs.flatMap((tab) => Object.values(tab.info)).map((p) => p.labels ?? {});
    const ticketOf = (s) => labelsOf(s).map((l) => l.ticket).find((x) => TICKET.test(x ?? ""));
    return recs.flatMap((r, k) => {
      const sel = r.id === on;
      const last = r.spaces.length - 1;
      const at = sel ? spaceIndex(r) : -1;
      const pick = (i) => {
        setShared(SELECTED, r.id);
        setShared(SPACE, { record: r.id, i });
      };
      const infos = r.spaces.flatMap((s) => s.tabs.flatMap((tab) => Object.values(tab.info)));
      const note = r.state === "restoring" ? ["restoring", t.working]
        : r.state !== "pending" ? null
        : r.needs ? ["needs you", t.blocked]
        : [r.wait ?? "finishing turn", t.working];
      const name = h_flex().absolute().top(SLACK - 7).right(13).h(13).px(4).items_center().bg(t.chrome)
        .child(div().font_family(MONO).text_size(11.5).text_color(sel ? t.accent : t.muted).child(r.name ?? "unnamed"));
      return r.spaces.map((s, i) => {
        const ticket = ticketOf(s);
        const pr = labelsOf(s).map((l) => PR.exec(l.pr ?? "")?.[1]).find(Boolean);
        const known = this.archivedWork(r, i);
        const repo = s.repo ?? s.tabs.flatMap((tab) => Object.values(tab.info))[0]?.cwd?.split("/").pop() ?? "space";
        const card = press(h_flex().id(`record-${r.id}-${i}`).h(22).flex_none().px(8).gap(8).items_center().rounded(5), () => pick(i))
          .child(icon("cube").size(14).flex_none().text_color(t.dim))
          .child(div().min_w(0).truncate().text_size(14).font_semibold().text_color(i === at ? t.foreground : t.muted).child(repo))
          .child(div().flex_1())
          .when(Boolean(ticket) && !(i > 0 && ticketOf(r.spaces[i - 1]) === ticket), (el) => el.child(tag(t, known?.ticket ? ticketLook(t, known.ticket) : ["lin-unknown", t.dim], ticket)))
          .when(Boolean(pr), (el) => el.child(tag(t, known?.pr ? prLook(t, known.pr) : ["pr", t.dim], `#${pr}`)));
        const box = v_flex().id(`record-box-${r.id}-${i}`).flex_none().px(4).pt(i === 0 ? 8 : 4).border_x(1)
          .border_color(sel ? t.accent : t.border)
          .when(i === 0, (el) => el.border_t(1).rounded_t(12))
          .when(i === last, (el) => el.pb(4).border_b(1).rounded_b(12))
          .child(v_flex().flex_none().px(i === at ? 3 : 4).py(i === at ? 3 : 4).rounded(8).bg(i === at ? t.background : t.foreground + "06")
            .when(i === at, (el) => el.border(1).border_color(t.accent + "40")).child(card))
          .when(i === last, (el) => el.child(h_flex().px(12).pt(5).pb(1).gap(8).font_family(MONO).text_size(10.5).text_color(t.dim)
            .child(div().child(`${ago(Date.now() - r.at)} · ${plural(infos.filter((p) => p.session).length, "Claude")}`))
            .when(Boolean(note), (el) => el.child(div().flex_1()).child(div().text_color(note[1]).child(note[0])))));
        return v_flex().relative().flex_none().py(SLACK).mt((k > 0 && i === 0 ? 14 : 0) - (k === 0 && i === 0 ? 1 : 2) * SLACK).child(box)
          .when(i === 0, (el) => el.child(name));
      });
    });
  }

  // An empty view names itself here; the empty-view block over the panes offers the way out.
  empty(t, inArchive) {
    return v_flex().id("empty").size_full().pt(TOP).justify_center().items_center()
      .child(div().text_size(13).text_color(t.muted).child(inArchive ? "no archived spaces" : "no active spaces"));
  }

  // An empty view takes the panes' place too, so what's on screen matches the sidebar.
  showEmpty(view) {
    if (view === this.emptied) return;
    const left = Boolean(this.emptied) && !view;
    this.emptied = view;
    setShared(EMPTY, view);
    run("layout.select", { stack: "main-stack", child: view ? "empty-view" : "main" });
    // The empty view took the keyboard; alt-. back onto the space already shown doesn't move it.
    // Every space keeps a focused pane, so only the shown tab's counts.
    const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active)?.id;
    const pane = left && tab ? panes().find((p) => p.tab === tab && p.focused) : null;
    if (pane) run("pane.focus", { pane: pane.pane });
  }

  // In the empty strip beside the traffic lights, level with them. It takes no
  // press, so the strip still drags the window.
  archiveLabel(t) {
    return h_flex().id("archive-label").absolute().top(7).left(afterLights()).h(22).gap(6).items_center()
      .child(icon("archive").size(13).flex_none().text_color(archiveInk(t)))
      .child(div().font_family(MONO).text_size(10.5).font_semibold().text_color(archiveInk(t)).child("archive"));
  }

  render() {
    const archived = this.archived();
    const all = spaces();
    this.keepOpen(all, archived);
    const open = sets(all.filter((s) => !archived.has(s.id)));
    const archive = sets(all.filter((s) => archived.has(s.id)));
    const inArchive = this.stay(all, archived) === "archive";
    // The archive's selected group stands in for the panes, so the archive always shows the empty-view block.
    this.showEmpty(inArchive ? "archive" : open.length ? null : "open");
    // In the archive the archive's colour stands in for the accent, so the shown
    // card, its group's name and its address all say where you are.
    const base = theme();
    const t = inArchive ? { ...base, accent: archiveInk(base) } : base;
    const ps = panes();
    // A scrollable splits the height with its siblings, so the list scrolls
    // inside a plain flex_1 box and the archive keeps only the height it needs.
    const upper = (list) => v_flex().id("upper").flex_1().min_h(0).opacity(inArchive && open.length ? 0.45 : 1).transition("opacity", 150)
      .child(list.id("open").size_full().overflow_y_scrollbar().track_scroll(this.scroll));
    // The hairline sits outside the dimmed part so it stays stronger than the
    // archived groups' outlines, and takes the archive's colour in the archive.
    const shelf = (list) => v_flex().id("archive").flex_none()
      .border_t(inArchive ? 2 : 1).border_color(inArchive ? archiveInk(t) : t.dim + "80")
      .child(v_flex().id("archive-body").opacity(inArchive ? 1 : 0.45).transition("opacity", 150).child(list));
    const root = v_flex().id("tree").relative().size_full().bg(t.chrome)
      .on_mouse_move((e, cx) => {
        this.at = e.position;
        this.settle(cx);
      })
      .on_hover((on, cx) => {
        if (on) return;
        this.at = null;
        this.settle(cx);
      });
    if (narrow()) {
      this.reveal(this.scroll, open, ps);
      return root
        .child(upper(v_flex().pt(TOP).pb(8).gap(8).items_center().children(this.rail(t, open))))
        .when(archive.length > 0, (el) => el.child(shelf(v_flex().py(8).gap(8).items_center().children(this.rail(t, archive)))));
    }
    // One view shows in full, the one alt-j/k walks, and the footer names it.
    const recs = records();
    const stored = recs.reduce((n, r) => n + r.spaces.length, 0);
    const active = open.flat();
    if (inArchive) {
      const on = selectedRecord()?.id;
      const list = v_flex().id("body").flex_1().min_h(0)
        .child(recs.length
          ? v_flex().id("archive").size_full().overflow_y_scrollbar().track_scroll(this.archiveScroll)
            .pt(TOP).px(8).children(this.records(t, recs, on))
          : this.empty(t, true));
      const marks = active.filter((s) => s.status && s.status !== "idle").map((s) => status(t, s.status));
      return root.child(list).child(this.footer(t, stored, active.length, marks, true)).child(this.archiveLabel(t));
    }
    this.reveal(this.scroll, active.map((s) => [s]), ps);
    const terms = new Map(terminals().map((x) => [x.address, x]));
    const list = v_flex().id("body").flex_1().min_h(0)
      .child(open.length
        ? v_flex().id("open").size_full().overflow_y_scrollbar().track_scroll(this.scroll)
          .pt(TOP).px(8).children(this.cards(t, open, ps, terms, new Set()))
        : this.empty(t, false));
    return root.child(list).child(this.footer(t, active.length, stored, [], false));
  }
}
