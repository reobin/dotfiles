import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, theme, run } from "herdr";
import { ICONS, entryFor, target, prIcon, prColor, mergeLook, ago, open } from "./look.js";
import { panelShell } from "./panel.js";

const RESULT = { fail: ["fail", "ansi1"], pending: ["pend", "ansi3"], pass: ["ok", "ansi2"], skip: ["ok", "dim"] };
const REVIEW = { APPROVED: ["approved", "ansi2", "approved"], CHANGES_REQUESTED: ["changes", "ansi1", "changes requested"], COMMENTED: ["waiting", "dim", "commented"], DISMISSED: ["waiting", "dim", "dismissed"], PENDING: ["waiting", "dim", "pending"] };
const DECISION = { approved: "approved", changes: "changes requested", waiting: "review required" };

export function renderPr(view) {
  const t = theme();
  const space = spaces().find((s) => s.active);
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const pr = current?.pr;
  const icon = (name, color, size = 12) => { const el = svg(`${ICONS}/${name}.svg`).size(size).flex_none(); return color ? el.text_color(color) : el; };
  const section = (title, extra) => h_flex().px(6).gap(6).items_center().mb(6).text_size(11).text_color(t.muted)
    .child(div().font_semibold().child(title.toUpperCase())).when(Boolean(extra), (e) => e.child(div().text_color(t.foreground).child(extra)));
  const row = (id, children, url) => h_flex().id(id).h(24).flex_none().px(6).gap(8).items_center().rounded(6)
    .when(Boolean(url), (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => open(url))).children(children);

  const header = h_flex().h(42).flex_none().px(14).gap(8).items_center()
    .when(Boolean(pr), (e) => e.child(icon(prIcon(pr), prColor(pr, t), 14)).child(div().font_semibold().child(`#${pr.number}`))
      .child(div().px(7).rounded(9).text_size(10.5).font_semibold().bg(prColor(pr, t)).text_color(t.background).child(pr.state[0].toUpperCase() + pr.state.slice(1))))
    .when(!pr, (e) => e.child(div().font_semibold().child("Pull request")))
    .child(div().flex_1())
    .child(div().id("pr-refresh").p(4).rounded(5).cursor_pointer().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("status-tabs.refresh")).child(icon("refresh")))
    .when(Boolean(pr), (e) => e.child(h_flex().id("pr-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(pr.url)).child(icon("link")).child("GitHub")));

  if (!pr) {
    const note = !space ? "No space" : !work?.pr && !work?.prBranch ? "This pane is not on a git branch and has no PR label"
      : !current ? "Loading…" : current.prError ? `GitHub: ${current.prError}` : `No pull request for ${work.pr ?? work.prBranch}`;
    return panelShell(view, t, { header, body: div().p(14).text_color(current?.prError ? t.ansi1 : t.dim).child(note) });
  }

  const failing = pr.checks.filter((c) => c.result === "fail" || c.result === "pending");
  const passed = pr.checks.filter((c) => c.result === "pass" || c.result === "skip");
  const checkRow = (c, i) => row(`check-${i}`, [
    icon(RESULT[c.result][0], t[RESULT[c.result][1]]),
    div().flex_1().min_w(0).truncate().text_color(c.result === "skip" ? t.dim : t.foreground).child(c.workflow && c.workflow !== c.name ? `${c.workflow} / ${c.name}` : c.name),
    ...(c.required ? [div().text_size(11).text_color(t.dim).child("required")] : []),
  ], c.url);

  const merge = mergeLook(pr, t);
  const top = v_flex().px(14).pt(12).pb(12).gap(6)
    .child(div().text_size(14).font_semibold().child(pr.title))
    .child(div().text_size(11.5).text_color(t.muted).truncate().child(`${pr.branch} → ${pr.base}`))
    .child(h_flex().gap(6).text_size(11.5).text_color(t.muted)
      .child(div().text_color(t.ansi2).child(`+${pr.additions}`)).child(div().text_color(t.ansi1).child(`−${pr.deletions}`))
      .child(`· ${pr.files} files · updated ${ago(pr.updatedAt)}`))
    .when(Boolean(merge), (e) => e.child(h_flex().mt(4).px(8).py(6).gap(8).items_center().rounded(7).bg(t.raised)
      .child(icon(merge.icon, merge.color, 14)).child(div().flex_1().min_w(0).text_color(merge.color).child(merge.sentence))));

  const checks = v_flex().px(8).py(12)
    .child(section("Checks", pr.ci.total ? `${pr.ci.pass}/${pr.ci.total}` : "none"))
    .children(failing.map(checkRow))
    .when(view.showPassed, (e) => e.children(passed.map((c, i) => checkRow(c, failing.length + i))))
    .when(passed.length > 0, (e) => e.child(row("checks-toggle", [
      icon("ok", t.ansi2), div().text_color(t.muted).child(view.showPassed ? "Hide passed" : `${passed.length} passed or skipped`),
    ]).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { view.showPassed = !view.showPassed; cx.notify(); })));

  const reviews = v_flex().px(8).py(12)
    .child(section("Reviews", DECISION[pr.review] ?? (pr.state === "draft" ? "draft" : null)))
    .children(pr.reviews.map((r, i) => {
      const [name, color, label] = REVIEW[r.state] ?? REVIEW.COMMENTED;
      return row(`review-${i}`, [icon(name, t[color]), div().flex_1().truncate().child(r.login), div().text_size(11.5).text_color(t.dim).child(label)]);
    }))
    .children(pr.requested.map((login, i) => row(`requested-${i}`, [icon("waiting", t.dim), div().flex_1().truncate().text_color(t.muted).child(login), div().text_size(11.5).text_color(t.dim).child("requested")])));

  return panelShell(view, t, { header, body: v_flex().w_full().child(top).child(checks).child(reviews) });
}
