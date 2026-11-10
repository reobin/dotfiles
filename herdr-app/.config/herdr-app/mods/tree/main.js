// One sidebar list: every space, its tabs, their panes. A pane reads like a
// tmux window list: its callsign label, then the agent's icon, session title
// and status, or the program's name. The shown space sits on a card; only
// what needs you is marked. Under 160px wide, spaces only. Folded spaces
// sink under a hairline, and the section the shown space isn't in dims
// (space-nav walks one section at a time).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { mark } from "./marks.js";
import { spaces, panes, terminals, run, theme, layout, shared, setShared, openOverlay, exec, nextCommand } from "herdr";

const MONO = "JetBrains Mono";
const COLLAPSED = "tree.collapsed";
const CLEAR = "#00000000";
// The block is a window drag handle; this keeps the list clear of the traffic lights.
const TOP = 44;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Idle says nothing: a mark means work is running or waiting on you.
const status = (t, st) => mark(t, st);

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

// The press stops at the row so it doesn't drag the window.
function press(el, act) {
  return el
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_mouse_up("left", () => act());
}

export default class Tree extends View {
  init(_props, cx) {
    this.repo = {}; // where() -> the main checkout's folder name, null: not a repo
    this.asking = false;
    cx.timer.every(1000, (cx) => this.lookup(cx));
    this.lookup(cx);
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "space-up") this.move(-1);
        if (c === "space-down") this.move(1);
        if (c === "tab-left") this.moveTab(-1);
        if (c === "tab-right") this.moveTab(1);
        if (c === "toggle-collapse") this.toggle(spaces().find((s) => s.active)?.id);
      }
    });
  }

  // Persisted by space id; ids of closed spaces are dropped on the next toggle.
  collapsed() {
    return new Set(/** @type {string[]} */ (shared(COLLAPSED) ?? []));
  }

  toggle(id) {
    if (!id) return;
    const live = new Set(spaces().map((s) => s.id));
    const set = new Set([...this.collapsed()].filter((x) => live.has(x)));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setShared(COLLAPSED, [...set]);
    if (!set.has(id) || !spaces().find((s) => s.id === id)?.active) return;
    const open = spaces().filter((s) => !set.has(s.id) || s.id === id);
    const i = open.findIndex((s) => s.id === id);
    const next = open[i + 1] ?? open[i - 1];
    if (next) run("space.select", { id: next.id });
  }

  moveTab(step) {
    const tabs = spaces().find((s) => s.active)?.tabs ?? [];
    const i = tabs.findIndex((tab) => tab.active);
    const j = i + step;
    if (i < 0 || j < 0 || j >= tabs.length) return;
    run("tab.move", { id: tabs[i].id, index: j + 1 });
  }

  // space.move stays inside its machine's block, so stop at its edge.
  move(step) {
    const sp = spaces();
    const i = sp.findIndex((s) => s.active);
    const j = i + step;
    if (i < 0 || j < 0 || j >= sp.length || (sp[j].machine ?? null) !== (sp[i].machine ?? null)) return;
    run("space.move", { id: sp[i].id, index: j + 1 });
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

  // A folded space keeps its pane count and its status, so what needs you still shows.
  space(t, s, ps, inSet, folded) {
    const name = this.repo[where(s, ps)] ?? (s.named ? place(s, ps).split("/").pop() : s.name);
    const label = !inSet && s.name !== name ? s.name : null;
    const [primary, secondary] = label ? [label, name] : [name || s.name, null];
    const tabs = new Set(s.tabs.map((tab) => tab.id));
    const st = folded && s.status && s.status !== "idle" ? status(t, s.status) : null;
    return press(h_flex().id(`space-${s.id}`).h(30).flex_none().px(8).gap(6).items_center().rounded(3)
      .hover((x) => x.bg(t.hover)), () => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(div().min_w(0).truncate().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child(primary))
      .when(Boolean(secondary), (el) => el.child(div().flex_none().text_size(12.5).text_color(t.dim).child(secondary)))
      .when(folded, (el) => el
        .child(div().flex_1())
        .child(div().flex_none().font_family(MONO).text_size(11.5).text_color(t.dim)
          .child(`+${ps.filter((p) => tabs.has(p.tab)).length}`))
        .when(Boolean(st), (el) => el.child(st)));
  }

  // A section break, not an item: a hairline with the tab's place and name on it.
  tab(t, s, tab) {
    const shown = s.active && tab.active;
    const text = [String(tab.index), tab.named ? tab.name : null, tab.zoomed ? "zoomed" : null].filter(Boolean).join(" · ");
    const line = () => div().h(1).bg(t.border);
    return press(h_flex().id(`tab-${tab.id}`).h(23).flex_none().px(8).mt(2).gap(6).items_center().rounded(3)
      .hover((x) => x.bg(t.hover)), () => { run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: s.id } } }))
      .child(line().w(6).flex_none())
      .child(div().flex_shrink(0).max_w(180).truncate().text_size(11.5).font_medium().text_color(shown ? t.muted : t.dim).child(text))
      .child(line().flex_1());
  }

  pane(t, s, p, term) {
    const sign = p.terminal ? term?.labels?.callsign ?? shared("callsigns.given")?.[p.terminal] : null;
    const agent = p.program?.agent;
    const name = agent ? p.title || p.program.name : p.terminal ? p.program?.name ?? "shell" : p.title;
    const pic = agent && p.program.icon
      ? p.program.tint ? svg(p.program.icon).size(15).flex_none().text_color(t.dim) : image(p.program.icon).w(15).h(15).flex_none()
      : null;
    const on = s.active && p.focused;
    const st = status(t, p.status);
    return press(h_flex().id(`pane-${p.pane}`).h(28).flex_none().px(8).gap(8).items_center().rounded(3)
      .hover((x) => x.bg(t.hover)), () => run("pane.focus", { pane: p.pane }))
      .child(h_flex().flex_none().min_w(28).h(19).px(5).justify_center().items_center().rounded(2)
        .font_family(MONO).text_size(11.5).font_semibold()
        .bg(on ? t.accent + "24" : t.foreground + "0f").text_color(on ? t.accent : t.muted).child(sign ?? "·"))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).when(on, (el) => el.font_medium()).text_color(on ? t.foreground : t.muted).child(name))
      .when(Boolean(st), (el) => el.child(st));
  }

  rows(t, s, ps, terms, inSet, folded) {
    if (folded) return [this.space(t, s, ps, inSet, true)];
    const mine = s.tabs.map((tab) => [tab, ps.filter((p) => p.tab === tab.id)]);
    return [
      this.space(t, s, ps, inSet, false),
      ...mine.flatMap(([tab, list]) => [
        ...(s.tabs.length > 1 ? [this.tab(t, s, tab)] : []),
        ...list.map((p) => this.pane(t, s, p, terms.get(p.terminal))),
      ]),
    ];
  }

  // A run of neighbouring spaces shares one card under its name; the card
  // carries the name, so each space row shows its repo alone.
  group(t, run, ps, terms, folded) {
    const active = run.some((s) => s.active);
    const inSet = run.length > 1;
    return v_flex().id(`group-${run[0].id}`).flex_none().py(6).pl(10).pr(2).border_l(2)
      .border_color(active ? t.accent : CLEAR).when(active, (el) => el.bg(t.background))
      .when(inSet, (el) => el.child(div().h(20).flex_none().px(8).truncate()
        .text_size(11.5).font_semibold().text_color(t.dim).child(run[0].name)))
      .children(run.flatMap((s) => this.rows(t, s, ps, terms, inSet, folded.has(s.id))));
  }

  rail(t, runs) {
    return runs.map((run) => {
      const icons = this.icons(t, run);
      return run.length > 1
        ? v_flex().id(`set-${run[0].id}`).flex_none().gap(2).rounded(3).bg(t.foreground + "0a").children(icons)
        : icons[0];
    });
  }

  icons(t, list) {
    return list.map((s) => {
      const st = s.status && s.status !== "idle" ? status(t, s.status) : null;
      return press(h_flex().id(`space-${s.id}`).relative().size(34).flex_none().justify_center().items_center().rounded(3).border_l(2)
        .border_color(s.active ? t.accent : CLEAR)
        .when(s.active, (el) => el.bg(t.background))
        .when(!s.active, (el) => el.hover((x) => x.bg(t.hover))), () => run("space.select", { id: s.id }))
        .child(div().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child([...s.name][0]?.toUpperCase() ?? "?"))
        .when(Boolean(st), (el) => el.child(div().absolute().top(3).right(3).child(st)));
    });
  }

  render() {
    const t = theme();
    const folded = this.collapsed();
    const all = spaces();
    const top = sets(all.filter((s) => !folded.has(s.id)));
    const dock = sets(all.filter((s) => folded.has(s.id)));
    const docked = all.some((s) => s.active && folded.has(s.id));
    // A scrollable splits the height with its siblings, so the list scrolls
    // inside a plain flex_1 box and the dock keeps only the height it needs.
    const upper = (list) => v_flex().flex_1().min_h(0).opacity(docked && top.length ? 0.45 : 1).transition("opacity", 150)
      .child(list.id("top").size_full().overflow_y_scrollbar());
    const shelf = (list) => v_flex().id("dock").flex_none().border_t(1).border_color(t.border)
      .opacity(docked ? 1 : 0.45).transition("opacity", 150).child(list);
    const root = v_flex().size_full().bg(t.chrome);
    if (narrow()) {
      return root
        .child(upper(v_flex().pt(TOP).pb(8).gap(6).items_center().children(this.rail(t, top))))
        .when(dock.length > 0, (el) => el.child(shelf(v_flex().py(8).gap(6).items_center().children(this.rail(t, dock)))));
    }
    const ps = panes();
    const terms = new Map(terminals().map((x) => [x.address, x]));
    return root
      .child(upper(v_flex().pt(TOP).pb(12).gap(2).children(top.map((run) => this.group(t, run, ps, terms, folded)))))
      .when(dock.length > 0, (el) => el.child(shelf(v_flex().pt(6).pb(12).gap(2)
        .children(dock.map((run) => this.group(t, run, ps, terms, folded))))));
  }
}
