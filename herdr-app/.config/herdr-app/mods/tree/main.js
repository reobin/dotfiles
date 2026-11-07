// One sidebar list: every space, its tabs, their panes. A pane reads like a
// tmux window list: its callsign label, then the agent's icon, session title
// and status, or the program's name. The shown space sits on a card; only
// what needs you is marked. Under 160px wide, spaces only.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, terminals, run, theme, layout, shared, openOverlay, exec, nextCommand } from "herdr";

const MONO = "JetBrains Mono";
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
function status(t, st) {
  if (st === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
  if (st === "done") return div().size(7).flex_none().rounded(3.5).bg(t.done);
  if (st === "blocked") return div().size(7).flex_none().rounded(3.5).bg(t.blocked);
  return null;
}

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s, ps) {
  const tabs = new Set(s.tabs.map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);

// Neighbouring named spaces with the same name group; the list is never
// reordered, so it stays in alt-j/k order. Unnamed names follow folders, so
// they never group.
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
      }
    });
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

  space(t, s, ps, agentCount, inSet) {
    const name = this.repo[where(s, ps)] ?? (s.named ? place(s, ps).split("/").pop() : s.name);
    const label = !inSet && s.name !== name ? s.name : null;
    const [primary, secondary] = label ? [label, name] : [name || s.name, null];
    const st = agentCount > 1 ? status(t, s.status) : null;
    return press(h_flex().id(`space-${s.id}`).h(30).flex_none().px(8).gap(6).items_center().rounded(3)
      .hover((x) => x.bg(t.hover)), () => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(div().min_w(0).truncate().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child(primary))
      .when(Boolean(secondary), (el) => el.child(div().flex_none().text_size(12.5).text_color(t.dim).child(secondary)))
      .child(div().flex_1())
      .when(Boolean(st), (el) => el.child(st));
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

  rows(t, s, ps, terms, inSet) {
    const mine = s.tabs.map((tab) => [tab, ps.filter((p) => p.tab === tab.id)]);
    const agentCount = mine.reduce((n, [, list]) => n + list.filter((p) => p.status).length, 0);
    return [
      this.space(t, s, ps, agentCount, inSet),
      ...mine.flatMap(([tab, list]) => [
        ...(s.tabs.length > 1 ? [this.tab(t, s, tab)] : []),
        ...list.map((p) => this.pane(t, s, p, terms.get(p.terminal))),
      ]),
    ];
  }

  // A run of neighbouring spaces shares one card under its name; the card
  // carries the name, so each space row shows its repo alone.
  group(t, run, ps, terms) {
    const active = run.some((s) => s.active);
    const inSet = run.length > 1;
    return v_flex().id(`group-${run[0].id}`).flex_none().py(6).pl(10).pr(2).border_l(2)
      .border_color(active ? t.accent : CLEAR).when(active, (el) => el.bg(t.background))
      .when(inSet, (el) => el.child(div().h(20).flex_none().px(8).truncate()
        .text_size(11.5).font_semibold().text_color(t.dim).child(run[0].name)))
      .children(run.flatMap((s) => this.rows(t, s, ps, terms, inSet)));
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
    const runs = sets(spaces());
    const root = v_flex().size_full().bg(t.chrome);
    if (narrow()) return root.child(v_flex().flex_1().min_h(0).pt(TOP).pb(8).gap(6).items_center().overflow_y_scrollbar().children(this.rail(t, runs)));
    const ps = panes();
    const terms = new Map(terminals().map((x) => [x.address, x]));
    return root.child(v_flex().flex_1().min_h(0).pt(TOP).pb(12).gap(2).overflow_y_scrollbar()
      .children(runs.map((run) => this.group(t, run, ps, terms))));
  }
}
