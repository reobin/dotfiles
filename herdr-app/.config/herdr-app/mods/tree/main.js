// One sidebar list: every space, its tabs, their panes. Each space is a card,
// the shown one outlined, and a group of spaces sits in an outlined box. An
// agent pane gets a row with its icon, session title and status; any other
// pane is a chip with its callsign and program, and a tab with no agent folds
// to one line of chips. Only what needs you is marked. Under 160px wide,
// spaces only. Folded spaces sink under a hairline, and the section the shown
// space isn't in dims (space-nav walks one section at a time).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { mark } from "./marks.js";
import { spaces, panes, terminals, run, theme, layout, shared, setShared, openOverlay, exec, nextCommand } from "herdr";

const MONO = "JetBrains Mono";
const COLLAPSED = "tree.collapsed";
// The block is a window drag handle; this keeps the list clear of the traffic
// lights and level with the pane's top (42px tab bar + 8px padding).
const TOP = 50;
const icon = (name) => svg(`mods/tree/${name}.svg`);
const isAgent = (p) => Boolean(p.program?.agent);
// A tab whose content fits on its label's line: no agent at all, or one agent alone.
const quiet = (list) => list.length > 0 && !list.some(isAgent);
const solo = (list) => (list.length === 1 && isAgent(list[0]) ? list[0] : null);

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
        if (c === "close-space") this.close();
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
    return press(this.lit(h_flex().id(`space-${s.id}`).h(28).flex_none().px(6).gap(6).items_center().rounded(5),
      `space-${s.id}`), () => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(icon("cube").size(14).flex_none().text_color(t.dim))
      .child(div().min_w(0).truncate().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child(primary))
      .child(div().flex_1())
      .when(Boolean(secondary), (el) => el.child(h_flex().flex_none().gap(4).items_center().text_color(t.dim)
        .child(icon("book").size(12))
        .child(div().font_family(MONO).text_size(11).child(secondary))))
      .when(folded, (el) => el
        .child(div().flex_none().font_family(MONO).text_size(11.5).text_color(t.dim)
          .child(`+${ps.filter((p) => tabs.has(p.tab)).length}`))
        .when(Boolean(st), (el) => el.child(st)));
  }

  // The tab's place and name. A tab with no agent ends there: its panes
  // follow on the same line as chips, with the worst status at the end. A
  // lone agent follows as its row, and the tab name gives way to its title.
  tab(t, s, tab, list, terms) {
    const shown = s.active && tab.active;
    const one = solo(list);
    const st = quiet(list) ? worst(t, list) : null;
    const label = h_flex().flex_none().h(22).gap(5).items_center()
      .child(icon("window").size(12).flex_none().text_color(t.dim))
      .child(div().flex_none().font_family(MONO).text_size(11).font_semibold().text_color(shown ? t.foreground : t.muted).child(String(tab.index)))
      .when(tab.named, (el) => el.child(div().min_w(0).max_w(one ? 90 : 140).truncate().text_size(11.5).text_color(t.dim).child(tab.name)))
      .when(tab.zoomed, (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim).child("zoomed")));
    // Chips wrap in their own column, so a second line starts under the
    // first chip rather than under the tab icon.
    return press(this.lit(h_flex().id(`tab-${tab.id}`).min_h(22).flex_none().px(8).gap(5),
      `tab-${tab.id}`), () => { run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
      .when(!one, (el) => el.items_start())
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: s.id } } }))
      .child(label)
      .when(Boolean(one), (el) => el.child(this.pane(t, s, one, terms.get(one?.terminal), true)))
      .when(quiet(list), (el) => el
        .child(h_flex().flex_1().min_w(0).flex_wrap().gap(4).pl(3)
          .children(list.map((p) => this.chip(t, s, p, terms.get(p.terminal)))))
        .when(Boolean(st), (el) => el.child(h_flex().flex_none().h(22).items_center().child(st))));
  }

  label(p, term) {
    const sign = p.terminal ? term?.labels?.callsign ?? shared("callsigns.given")?.[p.terminal] : null;
    const name = isAgent(p) ? p.title || p.program.name : p.terminal ? p.program?.name ?? "shell" : p.title;
    return [sign, name];
  }

  // Any pane that isn't an agent: its callsign and program.
  chip(t, s, p, term) {
    const [sign, name] = this.label(p, term);
    const on = s.active && p.focused;
    const st = status(t, p.status);
    return press(h_flex().id(`pane-${p.pane}`).h(22).flex_none().pl(2).pr(7).gap(5).items_center().rounded(4)
      .bg(t.foreground + "08").hover((x) => x.bg(t.hover)), () => run("pane.focus", { pane: p.pane }))
      .when(Boolean(sign), (el) => el.child(h_flex().flex_none().min_w(24).h(17).px(4).justify_center().items_center().rounded(2)
        .font_family(MONO).text_size(11).font_semibold()
        .bg(on ? t.accent + "24" : t.foreground + "0f").text_color(on ? t.accent : t.muted).child(sign)))
      .child(div().min_w(0).max_w(140).truncate().text_size(12).text_color(on ? t.foreground : t.muted).child(name ?? ""))
      .when(Boolean(st), (el) => el.child(st));
  }

  // Agents get rows; the rest of the tab gathers in one wrapping line of chips.
  paneList(t, s, list, terms) {
    const tools = list.filter((p) => !isAgent(p));
    return [
      ...list.filter(isAgent).map((p) => this.pane(t, s, p, terms.get(p.terminal))),
      ...(tools.length ? [h_flex().flex_none().flex_wrap().gap(4).px(8).py(3)
        .children(tools.map((p) => this.chip(t, s, p, terms.get(p.terminal))))] : []),
    ];
  }

  // inline: on its tab's line, it takes the rest of the line instead of a row.
  pane(t, s, p, term, inline = false) {
    const [sign, name] = this.label(p, term);
    const agent = p.program?.agent;
    const pic = agent && p.program.icon
      ? p.program.tint ? svg(p.program.icon).size(15).flex_none().text_color(t.dim) : image(p.program.icon).w(15).h(15).flex_none()
      : null;
    const on = s.active && p.focused;
    const st = status(t, p.status);
    return press(h_flex().id(`pane-${p.pane}`).h(28).gap(8).items_center().rounded(3)
      .when(inline, (el) => el.flex_1().min_w(0).pl(4))
      .when(!inline, (el) => el.flex_none().px(8))
      .hover((x) => x.bg(t.hover)), () => run("pane.focus", { pane: p.pane }))
      .child(h_flex().flex_none().min_w(28).h(19).px(5).justify_center().items_center().rounded(2)
        .font_family(MONO).text_size(11.5).font_semibold()
        .bg(on ? t.accent + "24" : t.foreground + "0f").text_color(on ? t.accent : t.muted).child(sign ?? "·"))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).when(on, (el) => el.font_medium()).text_color(on ? t.foreground : t.muted).child(name))
      .when(Boolean(st), (el) => el.child(st));
  }

  // Hovering a space's or tab's title row lights the whole card or tab block,
  // so the row only reports the hover.
  lit(el, key) {
    return el.on_hover((on, cx) => {
      if (on) this.hot = key;
      else if (this.hot === key) this.hot = null;
      cx.notify();
    });
  }

  rows(t, s, ps, terms, inSet, folded) {
    if (folded) return [this.space(t, s, ps, inSet, true)];
    const mine = s.tabs.map((tab) => [tab, ps.filter((p) => p.tab === tab.id)]);
    return [
      this.space(t, s, ps, inSet, false),
      ...mine.flatMap(([tab, list]) => s.tabs.length > 1
        ? [v_flex().flex_none().mt(2).rounded(5).when(this.hot === `tab-${tab.id}`, (el) => el.bg(t.hover))
          .child(this.tab(t, s, tab, list, terms))
          .children(quiet(list) || solo(list) ? [] : this.paneList(t, s, list, terms))]
        : this.paneList(t, s, list, terms)),
    ];
  }

  // The shown card's outline takes a pixel of its padding, so nothing shifts
  // when it moves.
  card(t, s, ps, terms, inSet, folded) {
    const pad = s.active ? 1 : 0;
    return v_flex().id(`card-${s.id}`).flex_none().px(4 - pad).pt(2 - pad).pb((folded ? 2 : 4) - pad).rounded(9)
      .bg(this.hot === `space-${s.id}` ? t.hover : s.active ? t.background : t.foreground + "06")
      .when(s.active, (el) => el.border(1).border_color(t.accent + "73"))
      .children(this.rows(t, s, ps, terms, inSet, folded));
  }

  // A run of neighbouring spaces shares an outlined box under its name; the
  // box carries the name, so each space shows its repo alone.
  group(t, run, ps, terms, folded) {
    if (run.length === 1) return this.card(t, run[0], ps, terms, false, folded.has(run[0].id));
    // The shown space's group echoes its card's outline, fainter.
    const here = run.some((s) => s.active);
    return v_flex().id(`group-${run[0].id}`).flex_none().p(4).gap(4).rounded(12).border(1)
      .border_color(here ? t.accent + "40" : t.border)
      .child(h_flex().h(24).flex_none().px(6).gap(6).items_center()
        .child(icon("layers").size(13).flex_none().text_color(here ? t.muted : t.dim))
        .child(div().min_w(0).truncate().text_size(12).font_semibold().text_color(here ? t.foreground : t.muted).child(run[0].name)))
      .children(run.map((s) => this.card(t, s, ps, terms, true, folded.has(s.id))));
  }

  rail(t, runs) {
    return runs.map((run) => {
      const icons = this.icons(t, run);
      return run.length > 1
        ? v_flex().id(`set-${run[0].id}`).flex_none().gap(2).rounded(8).bg(t.foreground + "0a").children(icons)
        : icons[0];
    });
  }

  icons(t, list) {
    return list.map((s) => {
      const st = s.status && s.status !== "idle" ? status(t, s.status) : null;
      return press(h_flex().id(`space-${s.id}`).relative().size(34).flex_none().justify_center().items_center().rounded(8)
        .when(s.active, (el) => el.bg(t.background))
        .when(!s.active, (el) => el.hover((x) => x.bg(t.hover))), () => run("space.select", { id: s.id }))
        .child(div().text_size(14).font_semibold().text_color(s.active ? t.foreground : t.muted).child([...s.name][0]?.toUpperCase() ?? "?"))
        .when(Boolean(st), (el) => el.child(div().absolute().top(3).right(3).child(st)));
    });
  }

  // Nearest open space to id, below first.
  nearestOpen(order, id, all, folded) {
    const i = order.indexOf(id);
    const open = (x) => all.some((s) => s.id === x) && !folded.has(x);
    return [...order.slice(i + 1), ...order.slice(0, i).reverse()].find(open);
  }

  // Herdr shows the closed space's neighbour, which may be folded, so move
  // to an open one first and close the space from behind.
  close() {
    const all = spaces();
    const folded = this.collapsed();
    const id = all.find((s) => s.active)?.id;
    if (!id) return;
    const next = folded.has(id) ? null : this.nearestOpen(all.map((s) => s.id), id, all, folded);
    if (next) run("space.select", { id: next });
    run("space.close", { id });
  }

  // Fallback for closes that skip close(), like a space's last pane exiting.
  keepOpen(all, folded) {
    const now = all.find((s) => s.active)?.id;
    if (!now) return;
    const [was, order] = [this.shown, this.order];
    this.shown = now;
    this.order = all.map((s) => s.id);
    if (!was || was === now || folded.has(was) || !folded.has(now) || all.some((s) => s.id === was)) return;
    const next = this.nearestOpen(order, was, all, folded);
    if (next) run("space.select", { id: next });
  }

  render() {
    const t = theme();
    const folded = this.collapsed();
    const all = spaces();
    this.keepOpen(all, folded);
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
      .child(upper(v_flex().pt(TOP).pb(12).px(8).gap(8).children(top.map((run) => this.group(t, run, ps, terms, folded)))))
      .when(dock.length > 0, (el) => el.child(shelf(v_flex().pt(8).pb(12).px(8).gap(8)
        .children(dock.map((run) => this.group(t, run, ps, terms, folded))))));
  }
}
