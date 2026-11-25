// Stands in for the panes while the tree sidebar holds an empty view or the
// archive: the tree switches the main-stack to this block and names the view
// in tree.empty. In the archive it shows the selected group's record: where
// each Claude left off, whether its PRs are done, and whether it comes back
// intact. It takes the keyboard when it shows, so typing can't reach the
// hidden space's terminals; the tree hands focus back to a pane when it goes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, shared, setShared, checking, home, exec, layout } from "herdr";

const MONO = "JetBrains Mono";
const EMPTY = "tree.empty";
// Read as tree reads them.
const RECORDS = "restore.records";
const SELECTED = "archive.selected";
const SPACE = "archive.space";
const ICONS = "data/status-tabs/icons";
const TICKET = /^[A-Za-z][A-Za-z0-9]{1,4}-\d{1,6}$/;
const PR = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)$/;
// PR states and folder checks are looked up again after this long.
const STALE = 5 * 60 * 1000;
const RECAP = 280;
function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const panelOpen = () => { const p = find(layout(), "panel"); return Boolean(p) && !p.hidden; };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ago(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

const tag = (t, name, text, color) => h_flex().flex_none().gap(3).items_center()
  .child(svg(`${ICONS}/${name}.svg`).size(12).flex_none().text_color(color ?? t.dim))
  .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(text));

// A state word on a wash of its own colour.
const pill = (t, text, color) => div().flex_none().h(18).px(6).flex().items_center().rounded(5).bg(color + "1f")
  .font_family(MONO).text_size(10.5).text_color(color).child(text);

// Holds the place of something still being looked up, at its size, so nothing moves when it lands.
const skeleton = (t, w, h = 18) => div().flex_none().w(w).h(h).rounded(5).bg(t.foreground + "14")
  .loop("opacity", { from: 0.4, to: 1, period: 1100 });

// What gh says about a PR, in the words and colours the tree uses.
function look(t, pr) {
  if (!pr) return null;
  if (pr.state === "MERGED") return ["merged", t.ansi5];
  if (pr.state === "CLOSED") return ["closed", t.dim];
  if (pr.isDraft) return ["draft", t.dim];
  if (pr.reviewDecision === "APPROVED") return ["approved", t.ansi2];
  if (pr.reviewDecision === "CHANGES_REQUESTED") return ["changes requested", t.ansi1];
  return ["review required", t.ansi3];
}

const infosOf = (s) => s.tabs.flatMap((tab) => Object.values(tab.info));
const labelOf = (s, key) => infosOf(s).map((p) => p.labels?.[key]).find(Boolean) ?? null;
const folderOf = (s) => { const p = infosOf(s)[0]; return p?.sessionCwd || p?.cwd || null; };

// The session title without the ticket and repo it repeats.
function strip(title, ticket, repo) {
  let text = title ?? "";
  if (ticket && text.startsWith(ticket + " ")) text = text.slice(ticket.length + 1);
  if (repo && text.startsWith(repo + " ")) text = text.slice(repo.length + 1);
  return text;
}

export default class EmptyView extends View {
  init(_props, cx) {
    this.focus = cx.focus_handle();
    this.took = false;
    this.prs = new Map(); // PR url -> { pr, at }
    this.folders = new Map(); // folder -> { problem, at }
    this.asking = new Set();
    if (checking()) return;
    cx.timer.every(50, (cx) => {
      const shown = Boolean(shared(EMPTY));
      // It takes the keyboard when it shows, and back when the side panel it lent it to closes.
      const open = panelOpen();
      if (shown && (!this.took || (this.lent && !open))) this.focus.focus();
      this.took = shown;
      this.lent = open;
      // Like a pane, its border says whether it has the keyboard, so a panel taking it moves the mark there.
      const has = this.focus.is_focused();
      if (has !== this.has) {
        this.has = has;
        cx.notify();
      }
    });
    cx.timer.every(1000, (cx) => this.lookup(cx));
  }

  selected() {
    const list = /** @type {any[]} */ (shared(RECORDS) ?? []);
    const r = list.find((x) => x.id === shared(SELECTED)) ?? list[0] ?? null;
    const at = /** @type {any} */ (shared(SPACE));
    return { r, i: r && at?.record === r.id ? Math.min(at.i, r.spaces.length - 1) : 0 };
  }

  // The selected group's PR states and folders, looked up while it shows.
  lookup(cx) {
    if (shared(EMPTY) !== "archive") return;
    const { r } = this.selected();
    if (!r) return;
    const now = Date.now();
    const due = (map, key) => !this.asking.has(key) && now - (map.get(key)?.at ?? 0) > STALE;
    for (const s of r.spaces) {
      const url = PR.test(labelOf(s, "pr") ?? "") ? labelOf(s, "pr") : null;
      if (url && due(this.prs, url)) this.ask(cx, url, async () => {
        const out = await exec("gh", ["pr", "view", url, "--json", "state,reviewDecision,isDraft"], { cwd: home() });
        this.prs.set(url, { pr: out.code === 0 ? JSON.parse(out.stdout) : null, at: Date.now() });
      });
      const folder = folderOf(s);
      if (folder && due(this.folders, folder)) this.ask(cx, folder, async () => {
        const there = (await exec("test", ["-d", folder])).code === 0;
        const status = there ? await exec("git", ["-C", folder, "status", "--porcelain"]) : null;
        const dirty = status?.code === 0 ? status.stdout.split("\n").filter(Boolean).length : 0;
        const problem = !there ? "folder deleted, comes back empty" : dirty ? `${plural(dirty, "uncommitted file")}` : null;
        this.folders.set(folder, { problem, at: Date.now() });
      });
    }
  }

  ask(cx, key, work) {
    this.asking.add(key);
    cx.spawn(async (cx) => {
      try {
        await work();
      } catch (_) {
        // A lookup that fails shows nothing; it's tried again after STALE.
      } finally {
        this.asking.delete(key);
        cx.notify();
      }
    });
  }

  // One space: its repo, ticket and PR with its state, its session title,
  // where its Claude left off, and what won't come back as it was.
  card(t, r, s, i, on, shared) {
    const infos = infosOf(s);
    const claude = infos.filter((p) => p.session);
    const lead = claude[0] ?? infos[0];
    const ticket = labelOf(s, "ticket");
    const url = labelOf(s, "pr");
    const number = PR.exec(url ?? "")?.[1];
    const state = look(t, this.prs.get(url)?.pr);
    const loading = Boolean(number) && !this.prs.has(url);
    const repo = s.repo ?? (lead?.cwd ?? "").split("/").pop() ?? "space";
    const title = lead?.title && lead.title !== lead.terminal ? strip(lead.title, ticket, repo) : "";
    const recap = !lead?.session ? null
      : lead.recap ? (lead.recap.length > RECAP ? lead.recap.slice(0, RECAP - 1) + "…" : lead.recap)
      : r.state === "pending" ? "recap saved when it closes"
      : r.closedAt ? "nothing to recap" : "archived before recaps were saved";
    const problem = this.folders.get(folderOf(s))?.problem;
    const others = infos.filter((p) => !p.session && !p.codex && p.program && !/^(zsh|bash|fish|sh)$/.test(p.program));
    const foot = [
      problem ? [problem, t.working] : null,
      ...others.map((p) => [`${p.program} comes back as a shell`, t.working]),
      claude.length > 1 ? [`+${plural(claude.length - 1, "more Claude")}`, t.dim] : null,
      lead?.active ? [`active ${ago(Date.now() - lead.active)}`, t.dim] : null,
    ].filter(Boolean);
    return v_flex().id(`summary-${i}`).w(440).flex_none().gap(8).px(14).py(12).rounded(10)
      .bg(on ? t.ansi5 + "14" : t.foreground + "06").hover((x) => x.bg(on ? t.ansi5 + "1a" : t.foreground + "0a"))
      // Every card has the border, so selecting one moves nothing.
      .border(1).border_color(on ? t.ansi5 + "73" : t.foreground + "00")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_up("left", (_e, cx) => {
        cx.stop_propagation();
        setShared(SELECTED, r.id);
        setShared(SPACE, { record: r.id, i });
      })
      .child(h_flex().h(20).gap(8).items_center()
        .child(svg("mods/tree/cube.svg").size(13).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().text_color(t.foreground).child(repo))
        .when(Boolean(ticket) && ticket !== shared && TICKET.test(ticket), (el) => el.child(tag(t, "lin-unknown", ticket)))
        .when(Boolean(number), (el) => el.child(tag(t, "pr", `#${number}`, state?.[1])))
        .when(loading, (el) => el.child(skeleton(t, 64)))
        .when(Boolean(state), (el) => el.child(pill(t, state[0], state[1]))))
      .when(Boolean(title), (el) => el.child(div().text_size(12.5).font_medium().text_color(t.muted).child(title)))
      .when(Boolean(recap), (el) => el.child(div().text_size(12.5).line_height("19px").text_color(lead?.recap ? t.foreground : t.dim).child(recap)))
      // Cards in a row share its height, so the bottom line sits at the bottom of each.
      .child(div().flex_1())
      .when(foot.length > 0, (el) => el.child(h_flex().flex_wrap().gap(6).items_center().font_family(MONO).text_size(10.5)
        .children(foot.flatMap(([text, color], k) => [...(k ? [div().text_color(t.dim).child("·")] : []), div().text_color(color).child(text)]))));
  }

  // The group's shared ticket once, and how far its PRs got.
  banner(t, r) {
    const tickets = [...new Set(r.spaces.map((s) => labelOf(s, "ticket")).filter((x) => TICKET.test(x ?? "")))];
    const common = tickets.length === 1 && r.spaces.every((s) => labelOf(s, "ticket") || !infosOf(s).some((p) => p.session)) ? tickets[0] : null;
    const urls = r.spaces.map((s) => labelOf(s, "pr")).filter((u) => PR.test(u ?? ""));
    const states = urls.map((u) => look(t, this.prs.get(u)?.pr)).filter(Boolean);
    const counts = new Map();
    for (const [word, color] of states) counts.set(word, { n: (counts.get(word)?.n ?? 0) + 1, color });
    const done = urls.length > 0 && states.length === urls.length && states.every(([w]) => w === "merged");
    const why = r.state === "restoring" ? ["restoring…", t.working]
      : r.state !== "pending" ? null
      : r.needs ? [`${r.needs} needs you`, t.blocked]
      : [`${r.wait ?? "finishing its turn"}, closes when quiet`, t.working];
    const loading = urls.some((u) => !this.prs.has(u));
    const parts = [
      ...(common ? [tag(t, "lin-unknown", common)] : []),
      ...(why ? [pill(t, why[0], why[1])] : []),
      ...(loading ? [skeleton(t, 92), skeleton(t, 112)]
        : done ? [pill(t, `all ${plural(urls.length, "PR")} merged · done`, t.ansi5)]
        : [...counts].map(([word, { n, color }]) => pill(t, `${n} ${word}`, color))),
    ];
    // The row keeps its height empty or loading, so the cards under it never move.
    return { common, row: h_flex().h(20).flex_none().gap(8).items_center().children(parts) };
  }

  archive(t, r, i) {
    const ink = t.ansi5;
    const claude = r.spaces.flatMap(infosOf).filter((p) => p.session).length;
    const { common, row } = this.banner(t, r);
    const [key, what] = r.state === "restoring" ? [null, "restoring…"]
      : r.state === "pending" ? ["cmd-.", "brings it back now"]
      : ["cmd-.", `unarchive · brings back ${plural(r.spaces.length, "space")}, resumes ${plural(claude, "Claude session")}`];
    return v_flex().id("empty-view").track_focus(this.focus).size_full().rounded(12).bg(t.background).border(1).border_color(this.has ? ink : t.background).px(28).pt(24).pb(20).gap(16)
      .child(v_flex().flex_none().gap(10)
        .child(h_flex().gap(10).items_baseline()
          .child(div().font_family(MONO).text_size(16).font_semibold().text_color(ink).child(r.name ?? "unnamed"))
          .child(div().font_family(MONO).text_size(11.5).text_color(t.dim).child(`archived ${ago(Date.now() - r.at)} · ${plural(r.spaces.length, "space")}`)))
        .child(row))
      .child(div().id("archive-spaces").flex_1().min_h(0).overflow_y_scroll()
        .child(h_flex().flex_wrap().gap(12).items_stretch().children(r.spaces.map((s, k) => this.card(t, r, s, k, k === i, common)))))
      .child(h_flex().flex_none().gap(8).items_center().font_family(MONO).text_size(11.5).text_color(t.muted)
        .when(Boolean(key), (el) => el.child(div().flex_none().h(18).px(6).flex().items_center().rounded(5).border(1).border_color(t.border).bg(t.foreground + "08").text_size(10.5).child(key)))
        .child(div().child(what)));
  }

  render() {
    const t = theme();
    this.has = this.focus.is_focused();
    const inArchive = shared(EMPTY) === "archive";
    const { r, i } = inArchive ? this.selected() : { r: null, i: 0 };
    if (r) return this.archive(t, r, i);
    const ink = inArchive ? t.ansi5 : t.dim;
    const [glyph, what, key, act] = inArchive
      ? ["archive", "active spaces", "alt-.", () => run("space-nav.switch")]
      : ["cube", "new space", "cmd-n", () => run("mod.open", { name: "new-space" })];
    return v_flex().id("empty-view").track_focus(this.focus).size_full().rounded(12).bg(t.background).border(1).border_color(!this.has ? t.background : inArchive ? ink : t.accent).justify_center().items_center().gap(14)
      .child(svg(`mods/tree/${glyph}.svg`).size(28).text_color(ink))
      .child(h_flex().id("empty-view-act").h(28).px(12).gap(10).items_center().rounded(7)
        .font_family(MONO).text_size(12).text_color(t.muted)
        .bg(t.foreground + "0a").hover((x) => x.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_mouse_up("left", (_e, cx) => {
          cx.stop_propagation();
          act();
        })
        .child(div().child(what))
        .child(div().opacity(0.6).text_size(11).child(key)));
  }
}
