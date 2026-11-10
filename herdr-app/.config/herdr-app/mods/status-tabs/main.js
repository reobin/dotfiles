import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, setShared, layout, settings, nextCommand, watchFolder } from "herdr";
import { mark } from "./marks.js";
import { gitStatus, describe } from "./git.js";
import { ICONS, entryFor, target, refresh, installIcons, ticketIcon, prIcon, prColor, mergeLook, open } from "./status.js";

const PANEL_CHILDREN = { files: "files", ticket: "ticket-status", pr: "pr-status" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init(_props, cx) {
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
    cx.spawn(async (cx) => {
      try { if (await installIcons()) cx.notify(); }
      catch (e) { setShared("status-tabs.error", `icons: ${e?.message ?? e}`); }
    });
    this.git = {};
    cx.timer.every(60000, (cx) => this.kick(cx));
    // Worktrees keep their git dir outside the folder and remote machines have no watch.
    cx.timer.every(10000, (cx) => this.gitKick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh") this.kick(cx);
        else if (Object.hasOwn(PANEL_CHILDREN, command)) this.togglePanel(PANEL_CHILDREN[command]);
        else if (command === "open-ticket" || command === "open-pr") this.openLink(command);
      }
    });
  }

  openLink(command) {
    const space = spaces().find((s) => s.active);
    const entry = space ? entryFor(space.id) : null;
    if (!entry || entry.branch !== target(space).branch) return;
    open(command === "open-pr" ? entry.pr?.url : entry.ticket?.issue?.url);
  }

  kick(cx) {
    const space = spaces().find((s) => s.active);
    if (space) cx.spawn(async () => { await refresh(space); });
  }

  gitKick(cx) {
    const space = spaces().find((s) => s.active), t = space ? target(space) : null;
    if (!t?.cwd) return;
    if (this.gitBusy) { this.gitAgain = true; return; }
    this.gitBusy = true;
    if (!t.on) this.gitWatch(t.cwd, cx);
    cx.spawn(async (cx) => {
      try { this.git[`${t.on ?? ""}:${t.cwd}`] = await gitStatus(t.cwd, t.on).catch(() => null); }
      finally {
        this.gitBusy = false;
        if (this.gitAgain) { this.gitAgain = false; this.gitSoon(cx); }
        cx.notify();
      }
    });
  }

  // A build or an install fires a storm of events; one status per burst is enough.
  gitSoon(cx) {
    if (this.gitQueued) return;
    this.gitQueued = true;
    cx.timer.after(800, (cx) => { this.gitQueued = false; this.gitKick(cx); });
  }

  gitWatch(dir, cx) {
    if (this.watched === dir) return;
    this.watched = dir;
    cx.spawn(async (cx) => {
      try { while (this.watched === dir) { await watchFolder(dir); if (this.watched === dir) this.gitSoon(cx); } }
      catch { if (this.watched === dir) this.watched = null; }
    });
  }

  togglePanel(child) {
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    if (panel && !panel.hidden && body?.active === child) { run("layout.hide", { id: "panel" }); return; }
    run("layout.select", { stack: "panel-body", child });
    run("layout.show", { id: "panel" });
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render(cx) {
    const t = theme();
    const space = spaces().find(p => p.active);
    const work = space ? target(space) : null;
    const workKey = space ? `${space.id}|${work.branch}|${work.cwd}` : null;
    if (workKey !== this.workKey) { this.workKey = workKey; this.kick(cx); this.gitKick(cx); }
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .child(div().size(12).flex_none().flex().items_center().justify_center()
          .when(Boolean(mark(t, c.status)), el => el.child(mark(t, c.status))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = [...(shared("workspace.panels") ?? ["files"]), "ticket-status", "pr-status"].filter(id => find(body, id));
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, content) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => this.togglePanel(id)).children(content);
    };
    const reviewButton = () => {
      const cwd = work?.cwd;
      const drafts = Object.entries(shared("review.drafts") ?? {})
        .filter(([root]) => cwd && (cwd === root || cwd.startsWith(`${root}/`)))
        .reduce((n, [, list]) => n + list.length, 0);
      const g = work ? this.git[`${work.on ?? ""}:${cwd}`] : null;
      const clean = g && !g.files && !g.ahead && !g.behind;
      const count = (n, text, color) => n > 0 ? [div().text_size(11.5).text_color(color).child(`${text}${n}`)] : [];
      const branch = work?.branch || g?.branch;
      const tip = [branch ? `Review changes on ${branch}` : "Review changes", g ? describe(g) : null].filter(Boolean).join(" · ");
      return h_flex().id("review-open").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(t.chrome).text_color(t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => run("mod.open", { name: "review" }))
        .tooltip(tip)
        .child(svg("mods/workspace-chrome/git-compare.svg").size(14).flex_none())
        .child(div().max_w(200).truncate().child(branch ?? "Review"))
        .when(Boolean(g), el => el.children([...count(g.files, "", t.dim), ...count(g.add, "+", t.ansi2), ...count(g.del, "−", t.ansi1),
          ...count(g.ahead, "↑", t.ansi4), ...count(g.behind, "↓", t.ansi5)]))
        .when(Boolean(clean), el => el.child(div().text_size(11).text_color(t.dim).child("✓")))
        .when(drafts > 0, el => el.child(div().px(5).rounded(4).bg(t.accent).text_color(t.accent_foreground).text_size(10.5).child(String(drafts))));
    };
    const entry = space ? entryFor(space.id) : null;
    const current = entry && entry.branch === work?.branch ? entry : null;
    const ticket = current?.ticket;
    const pr = current?.pr;
    const ticketButton = () => panelButton("ticket-status", [
      svg(`${ICONS}/${ticketIcon(ticket)}.svg`).size(14).flex_none().text_color(ticket.issue?.state?.color ?? t.dim),
      div().child(ticket.id),
    ]);
    const prButton = () => {
      if (!pr) {
        const failed = Boolean(current.prError);
        return panelButton("pr-status", [svg(`${ICONS}/pr.svg`).size(14).flex_none().text_color(failed ? t.ansi1 : t.dim), div().text_color(t.dim).child(failed ? "PR ?" : "No PR")]);
      }
      // The icon's color says whether it can merge (grey draft, green ready, yellow waiting,
      // red needs fixing); the panel says why not.
      const merge = pr.state === "open" ? mergeLook(pr, t) : null;
      const color = pr.state === "draft" ? t.dim : pr.state === "open" ? merge?.color ?? t.dim : prColor(pr, t);
      return panelButton("pr-status", [
        svg(`${ICONS}/${prIcon(pr)}.svg`).size(14).flex_none().text_color(color),
        div().child(`#${pr.number}`),
      ]);
    };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.length > 1 ? shown.map(item) : []))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", [svg("mods/files/file.svg").size(14), "Files"])))
      .child(reviewButton())
      .when(Boolean(ticket), el => el.child(ticketButton()))
      .when(Boolean(pr || (current && ticket) || current?.prError), el => el.child(prButton()))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/status-tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/status-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/status-tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
