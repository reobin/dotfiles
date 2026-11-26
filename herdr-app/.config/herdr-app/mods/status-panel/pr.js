import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { MONO, entryFor, target, shown, prIcon, prColor, mergeLook, ago, open } from "./look.js";
import { panelShell, icon, refreshButton } from "./panel.js";
import { avatar, hex } from "./picker.js";

const RESULT = { fail: ["fail", "ansi1"], pending: ["pend", "ansi3"], pass: ["ok", "ansi2"], skip: ["ok", "dim"] };
const REVIEW = { APPROVED: ["approved", "ansi2", "approved"], CHANGES_REQUESTED: ["changes", "ansi1", "changes requested"], COMMENTED: ["waiting", "dim", "commented"], DISMISSED: ["waiting", "dim", "dismissed"], PENDING: ["waiting", "dim", "pending"] };
const DECISION = { approved: "approved", changes: "changes requested", waiting: "review required" };

// Read-only: changes to a PR go through an agent or GitHub.
export function renderPr(view, _cx) {
  const t = theme();
  const space = shown();
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const pr = current?.pr;
  view.keymap = [];
  const section = (title, extra) => h_flex().px(6).gap(6).items_center().mb(6).text_size(11).text_color(t.muted)
    .child(div().font_semibold().child(title)).when(Boolean(extra), (e) => e.child(div().text_color(t.foreground).child(extra)));
  const row = (id, children, url) => h_flex().id(id).h(24).flex_none().px(6).gap(8).items_center().rounded(6)
    .when(Boolean(url), (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => open(url))).children(children);

  const header = h_flex().h(34).flex_none().px(14).gap(8).items_center().rounded_t(11).bg(t.accent + "14")
    .when(Boolean(pr), (e) => e.child(icon(prIcon(pr), prColor(pr, t), 14)).child(div().font_family(MONO).font_semibold().child(`#${pr.number}`))
      .child(div().px(7).rounded(9).text_size(10.5).font_semibold().bg(prColor(pr, t)).text_color(t.background).child(pr.state)))
    .when(!pr, (e) => e.child(div().font_semibold().child("pull request")))
    .child(div().flex_1())
    .child(refreshButton(view, t, work, null))
    .when(Boolean(pr), (e) => e.child(h_flex().id("pr-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(pr.url)).child(icon("link")).child("GitHub")));

  if (!pr) {
    const note = !space ? "no space" : !work?.pr && !work?.prBranch ? "this pane is not on a git branch and has no PR label"
      : !current ? "loading…" : current.prError ? `GitHub: ${current.prError}` : `no pull request for ${work.pr ?? work.prBranch}`;
    return panelShell(view, t, { header, body: div().p(14).text_color(current?.prError ? t.ansi1 : t.dim).child(note) });
  }

  const failing = pr.checks.filter((c) => c.result === "fail" || c.result === "pending");
  const passed = pr.checks.filter((c) => c.result === "pass" || c.result === "skip");
  const checkRow = (c, i) => row(`check-${i}`, [
    icon(RESULT[c.result][0], t[RESULT[c.result][1]]),
    div().flex_1().min_w(0).truncate().font_family(MONO).text_color(c.result === "skip" ? t.dim : t.foreground).child(c.workflow && c.workflow !== c.name ? `${c.workflow} / ${c.name}` : c.name),
    ...(c.required ? [div().text_size(11).text_color(t.dim).child("required")] : []),
  ], c.url);

  const merge = mergeLook(pr, t);
  const labels = pr.labels ?? [];
  const top = v_flex().px(14).pt(12).pb(12).gap(6)
    .child(div().text_size(14).font_semibold().child(pr.title))
    .child(div().font_family(MONO).text_size(11.5).text_color(t.muted).truncate().child(`${pr.branch} → ${pr.base}`))
    .child(h_flex().gap(6).text_size(11.5).text_color(t.muted)
      .child(div().font_family(MONO).text_color(t.ansi2).child(`+${pr.additions}`)).child(div().font_family(MONO).text_color(t.ansi1).child(`−${pr.deletions}`))
      .child(`· ${pr.files} files · updated ${ago(pr.updatedAt)}`))
    .when(labels.length > 0, (e) => e.child(h_flex().gap(4).flex_wrap()
      .children(labels.map((l) => h_flex().px(6).gap(5).items_center().rounded(5).bg(hex(l.color) + "26").text_size(11).text_color(t.muted)
        .child(div().size(6).rounded(3).bg(hex(l.color))).child(l.name)))))
    .when(Boolean(merge), (e) => e.child(mergeBox(t, pr, merge)));

  const checks = v_flex().px(8).py(12)
    .child(section("checks", pr.ci.total ? `${pr.ci.pass}/${pr.ci.total}` : "none"))
    .children(failing.map(checkRow))
    .when(view.showPassed, (e) => e.children(passed.map((c, i) => checkRow(c, failing.length + i))))
    .when(passed.length > 0, (e) => e.child(row("checks-toggle", [
      icon("ok", t.ansi2), div().text_color(t.muted).child(view.showPassed ? "hide passed" : `${passed.length} passed or skipped`),
    ]).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { view.showPassed = !view.showPassed; cx.notify(); })));

  const reviews = v_flex().px(8).py(12)
    .child(section("reviews", DECISION[pr.review] ?? (pr.state === "draft" ? "draft" : null)))
    .children(pr.reviews.map((r, i) => {
      const [name, color, label] = REVIEW[r.state] ?? REVIEW.COMMENTED;
      return row(`review-${i}`, [avatar(t, r.login, 16), div().flex_1().truncate().child(r.login), icon(name, t[color]), div().text_size(11.5).text_color(t.dim).child(label)]);
    }))
    .children(pr.requested.map((login, i) => row(`requested-${i}`, [avatar(t, login, 16), div().flex_1().truncate().text_color(t.muted).child(login), icon("waiting", t.dim), div().text_size(11.5).text_color(t.dim).child("requested")])))
    .when(!pr.reviews.length && !pr.requested.length, (e) => e.child(div().px(6).text_size(12).text_color(t.dim).child("no reviewers yet")));

  view.keymap = [{ key: "o", label: "open", hint: true, run: () => open(pr.url) }];

  return panelShell(view, t, { header, body: v_flex().w_full().child(top).child(checks).child(reviews) });
}

const GATE = { ok: ["ok", "ansi2"], fail: ["fail", "ansi1"], wait: ["waiting", "ansi3"], pend: ["pend", "dim"] };

// Each thing GitHub checks before a merge, from the blockers status-tabs found.
function gates(pr) {
  const reasons = pr.merge?.reasons ?? [];
  const find = (test) => reasons.find(test);
  const conflict = find((r) => r.startsWith("conflicts")), failing = find((r) => r.endsWith(" failing")), running = find((r) => r.endsWith(" running"));
  const changes = find((r) => r === "changes requested"), approval = find((r) => r.includes("approv"));
  const behind = find((r) => r.startsWith("behind")), blocked = find((r) => r === "blocked by branch rules");
  const by = (state) => pr.reviews.filter((r) => r.state === state).map((r) => r.login).join(", ");
  return [
    conflict ? ["fail", conflict] : pr.merge?.ok === null ? ["pend", "checking for conflicts"] : ["ok", `no conflicts with ${pr.base}`],
    failing ? ["fail", failing] : running ? ["wait", running] : ["ok", "no required check failing"],
    changes ? ["fail", `changes requested by ${by("CHANGES_REQUESTED") || "a reviewer"}`]
      : approval ? ["wait", pr.requested.length ? `${approval}, requested from ${pr.requested.join(", ")}` : approval]
      : ["ok", by("APPROVED") ? `approved by ${by("APPROVED")}` : "no approval required"],
    behind ? ["wait", behind] : ["ok", `up to date with ${pr.base}`],
    ...(blocked ? [["fail", blocked]] : []),
  ];
}

// The merge verdict over a checklist of what's left, unresolved review threads included:
// GitHub can call a PR mergeable while a reviewer's question is still open.
function mergeBox(t, pr, merge) {
  const threads = pr.threads, people = threads?.filter((x) => !x.bot) ?? [], bots = threads?.filter((x) => x.bot) ?? [];
  const n = people.length + bots.length;
  const headline = pr.merge?.ok === false ? "not mergeable" : merge.sentence;
  const line = (id, [name, color], text, strong, extra = []) => h_flex().id(id).min_h(22).gap(8).items_center()
    .child(div().w(14).flex_none().flex().justify_center().child(icon(name, t[color] ?? color, 12)))
    .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(strong ? t.foreground : t.muted).child(text)).children(extra);
  const count = (list, name, color) => list.length ? [h_flex().flex_none().gap(2).items_center().font_family(MONO).text_size(11).text_color(color)
    .child(icon(name, color, 11)).child(String(list.length))] : [];
  const threadsLine = threads == null
    ? line("gate-threads", GATE.pend, "couldn't load review threads", false)
    : n ? line("gate-threads", ["comment", people.length ? "ansi3" : "dim"], `${n} unresolved thread${n === 1 ? "" : "s"}`, people.length > 0,
      [...count(people, "comment", t.ansi3), ...count(bots, "bot", t.dim)])
    : line("gate-threads", GATE.ok, "no unresolved threads", false);
  const threadRow = (x, i) => h_flex().id(`thread-${i}`).h(24).flex_none().pl(22).pr(4).gap(7).items_center().rounded(6)
    .when(Boolean(x.url), (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => open(x.url)))
    .child(avatar(t, x.who, 16))
    .child(div().flex_none().max_w(120).truncate().text_size(12).font_semibold().text_color(x.bot ? t.muted : t.foreground).child(x.who))
    .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(x.bot ? t.dim : t.muted).child(x.body || "no text"))
    .when(x.outdated, (e) => e.child(div().flex_none().px(4).rounded(3).bg(t.background).font_family(MONO).text_size(10).text_color(t.dim).child("outdated")))
    .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${x.path.split("/").pop()}${x.line ? `:${x.line}` : ""}`));
  const botName = bots.every((x) => /copilot/i.test(x.who)) ? "copilot" : "bots";

  return v_flex().mt(4).px(8).py(6).gap(2).rounded(7).bg(t.raised)
    .child(h_flex().gap(8).items_start().mb(2)
      .child(div().mt(2).flex_none().child(icon(merge.icon, merge.color, 14)))
      .child(h_flex().flex_1().min_w(0).gap(6).flex_wrap().child(div().font_semibold().text_color(merge.color).child(headline))
        .when(Boolean(pr.merge?.ok) && people.length > 0, (e) => e.child(div().text_color(t.muted)
          .child(`${people.length} thread${people.length === 1 ? "" : "s"} still open`)))))
    .children(pr.state === "draft" ? [] : gates(pr).map(([state, text], i) => line(`gate-${i}`, GATE[state], text, state !== "ok")))
    .child(threadsLine)
    .children(people.map(threadRow))
    .when(bots.length > 0, (e) => e.child(h_flex().pl(22).pt(4).pb(2).gap(5).items_center().text_size(11).text_color(t.dim)
      .child(icon("bot", t.dim, 11)).child(`${botName} · ${bots.length}`)))
    .children(bots.map((x, i) => threadRow(x, people.length + i)));
}
