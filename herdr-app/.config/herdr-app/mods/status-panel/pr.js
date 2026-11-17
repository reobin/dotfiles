import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, theme, run } from "herdr";
import { MONO, entryFor, target, prIcon, prColor, mergeLook, ago, open } from "./look.js";
import { panelShell, act, valueOf, isPending, say, ask, kbd, spinner, icon, focusPanel, composer, openComposer, commentCard, isShown } from "./panel.js";
import { openPicker, anchored, avatar, hex } from "./picker.js";
import * as gh from "./github.js";

const RESULT = { fail: ["fail", "ansi1"], pending: ["pend", "ansi3"], pass: ["ok", "ansi2"], skip: ["ok", "dim"] };
const REVIEW = { APPROVED: ["approved", "ansi2", "approved"], CHANGES_REQUESTED: ["changes", "ansi1", "changes requested"], COMMENTED: ["waiting", "dim", "commented"], DISMISSED: ["waiting", "dim", "dismissed"], PENDING: ["waiting", "dim", "pending"] };
const DECISION = { approved: "approved", changes: "changes requested", waiting: "review required" };

export function renderPr(view, cx) {
  const t = theme();
  const space = spaces().find((s) => s.active);
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const real = current?.pr;
  view.keymap = [];
  const scope = real?.url;
  const pr = real && { ...real, state: valueOf(view, scope, "state", real.state), requested: valueOf(view, scope, "requested", real.requested), labels: valueOf(view, scope, "labels", real.labels ?? []) };
  const open_ = pr && (pr.state === "open" || pr.state === "draft");
  const section = (title, extra, actions = []) => h_flex().px(6).gap(6).items_center().mb(6).text_size(11).text_color(t.muted)
    .child(div().font_semibold().child(title.toUpperCase())).when(Boolean(extra), (e) => e.child(div().text_color(t.foreground).child(extra)))
    .child(div().flex_1()).children(actions);
  const row = (id, children, url) => h_flex().id(id).h(24).flex_none().px(6).gap(8).items_center().rounded(6)
    .when(Boolean(url), (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => open(url))).children(children);
  const button = (id, label, key, onClick, { busy, primary } = {}) => h_flex().id(id).h(22).px(7).gap(5).items_center().rounded(6).cursor_pointer()
    .text_size(11.5).font_semibold()
    .when(Boolean(primary), (el) => el.bg(t.solid).text_color(t.solid_foreground).hover((s) => s.opacity(0.9)))
    .when(!primary, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => { focusPanel(view); onClick(cx); })
    .when(Boolean(busy), (el) => el.child(spinner(t, 11)))
    .child(label).when(Boolean(key), (el) => el.child(div().opacity(0.6).font_family(MONO).text_size(10.5).child(key)));

  const header = h_flex().h(42).flex_none().px(14).gap(8).items_center()
    .when(Boolean(pr), (e) => e.child(icon(prIcon(pr), prColor(pr, t), 14)).child(div().font_family(MONO).font_semibold().child(`#${pr.number}`))
      .child(div().px(7).rounded(9).text_size(10.5).font_semibold().bg(prColor(pr, t)).text_color(t.background).child(pr.state[0].toUpperCase() + pr.state.slice(1))))
    .when(!pr, (e) => e.child(div().font_semibold().child("Pull request")))
    .child(div().flex_1())
    .child(div().id("pr-refresh").p(4).rounded(5).cursor_pointer().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { run("status-tabs.refresh"); if (view.prComments) view.prComments.at = 0; cx.notify(); }).child(icon("refresh")))
    .when(Boolean(pr), (e) => e.child(h_flex().id("pr-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(pr.url)).child(icon("link")).child("GitHub")));

  if (!pr) {
    const note = !space ? "No space" : !work?.pr && !work?.prBranch ? "This pane is not on a git branch and has no PR label"
      : !current ? "Loading…" : current.prError ? `GitHub: ${current.prError}` : `No pull request for ${work.pr ?? work.prBranch}`;
    return panelShell(view, t, { header, body: div().p(14).text_color(current?.prError ? t.ansi1 : t.dim).child(note) });
  }

  if (cx && isShown(view.panelName)) loadComments(view, cx, work, pr);

  const reviewers = (cx) => openPicker(view, cx, {
    field: "reviewers", placeholder: "Request reviewers…", multi: true,
    load: async () => {
      const reviewed = new Map(pr.reviews.map((r) => [r.login, (REVIEW[r.state] ?? REVIEW.COMMENTED)[2]]));
      return (await gh.users(work, pr)).filter((u) => u.login !== pr.author)
        .map((u) => ({ key: u.login, label: u.login, sub: reviewed.get(u.login) ?? u.name, person: true }));
    },
    checked: (it) => valueOf(view, scope, "requested", real.requested).includes(it.key),
    choose: (it, cx) => {
      const now = valueOf(view, scope, "requested", real.requested), on = now.includes(it.key);
      act(view, cx, { scope, field: "requested", value: on ? now.filter((l) => l !== it.key) : [...now, it.key],
        ok: on ? `Removed ${it.key}` : `Requested ${it.key}`, task: () => gh.setReviewer(work, pr, it.key, !on) });
    },
  });

  const labels = (cx) => openPicker(view, cx, {
    field: "pr-labels", placeholder: "Add or remove labels…", multi: true,
    load: async () => (await gh.repoLabels(work, pr)).map((l) => ({ key: l.name, label: l.name, dot: l.color })),
    checked: (it) => valueOf(view, scope, "labels", real.labels ?? []).some((l) => l.name === it.key),
    choose: (it, cx) => {
      const now = valueOf(view, scope, "labels", real.labels ?? []), on = now.some((l) => l.name === it.key);
      act(view, cx, { scope, field: "labels", value: on ? now.filter((l) => l.name !== it.key) : [...now, { name: it.key, color: it.dot }],
        task: () => gh.setLabel(work, pr, it.key, !on) });
    },
  });

  const toggleDraft = (cx) => {
    if (!open_) return say(view, cx, `This pull request is ${pr.state}`, "error");
    const draft = pr.state !== "draft";
    act(view, cx, { scope, field: "state", value: draft ? "draft" : "open", ok: draft ? "Converted to draft" : "Marked ready for review",
      task: () => gh.setDraft(work, pr, draft) });
  };

  const failedRuns = gh.failedRuns(pr);
  const rerun = (cx) => {
    if (!failedRuns.length) return say(view, cx, "No failed GitHub Actions runs to rerun");
    act(view, cx, { scope, field: "rerun", value: true, ok: `Rerunning failed jobs in ${failedRuns.length} run${failedRuns.length === 1 ? "" : "s"}`,
      task: () => gh.rerunFailed(work, pr) });
  };

  // Merging can't be undone: it always asks first, and only when GitHub says it can merge.
  const mergeIt = (cx) => {
    if (pr.state !== "open") return say(view, cx, pr.state === "draft" ? "Mark it ready for review first" : `This pull request is ${pr.state}`, "error");
    if (!pr.merge?.ok) return say(view, cx, pr.merge?.reasons?.length ? `Not mergeable: ${pr.merge.reasons.join(", ")}` : "GitHub hasn't said it can merge yet", "error");
    cx.spawn(async (cx) => {
      try {
        const method = await gh.mergeMethod(work, pr);
        ask(view, cx, { icon: "merge-ready", verb: gh.MERGE_LABEL[method], text: `${gh.MERGE_LABEL[method]} #${pr.number} into ${pr.base}?`,
          run: (cx) => act(view, cx, { scope, field: "state", value: "merged", ok: `Merged #${pr.number}`, task: () => gh.merge(work, pr, method) }) });
      } catch (e) { say(view, cx, String(e?.message ?? e), "error"); }
    });
  };

  const failing = pr.checks.filter((c) => c.result === "fail" || c.result === "pending");
  const passed = pr.checks.filter((c) => c.result === "pass" || c.result === "skip");
  const checkRow = (c, i) => row(`check-${i}`, [
    icon(RESULT[c.result][0], t[RESULT[c.result][1]]),
    div().flex_1().min_w(0).truncate().font_family(MONO).text_color(c.result === "skip" ? t.dim : t.foreground).child(c.workflow && c.workflow !== c.name ? `${c.workflow} / ${c.name}` : c.name),
    ...(c.required ? [div().text_size(11).text_color(t.dim).child("required")] : []),
  ], c.url);

  const merge = mergeLook(pr, t);
  const mergeAction = pr.state === "draft" ? button("pr-ready", "Ready for review", "d", toggleDraft, { busy: isPending(view, scope, "state") })
    : pr.state === "open" && pr.merge?.ok ? button("pr-merge", "Merge…", "m", mergeIt, { primary: true, busy: isPending(view, scope, "state") })
    : null;
  const labelTrigger = h_flex().id("pr-labels").min_h(24).px(6).gap(4).items_center().flex_wrap().rounded(6).cursor_pointer()
    .when(view.picker?.field === "pr-labels", (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => { focusPanel(view); labels(cx); })
    .when(pr.labels.length === 0, (el) => el.child(icon("tag", t.dim, 12)).child(div().text_size(11.5).text_color(t.dim).child("Add labels")))
    .children(pr.labels.map((l) => h_flex().px(6).gap(5).items_center().rounded(5).bg(hex(l.color) + "26").text_size(11).text_color(t.muted)
      .child(div().size(6).rounded(3).bg(hex(l.color))).child(l.name)))
    .when(isPending(view, scope, "labels"), (el) => el.child(spinner(t)))
    .child(div().flex_1()).child(kbd(t, "l"));

  const top = v_flex().px(14).pt(12).pb(12).gap(6)
    .child(div().text_size(14).font_semibold().child(pr.title))
    .child(div().font_family(MONO).text_size(11.5).text_color(t.muted).truncate().child(`${pr.branch} → ${pr.base}`))
    .child(h_flex().gap(6).text_size(11.5).text_color(t.muted)
      .child(div().font_family(MONO).text_color(t.ansi2).child(`+${pr.additions}`)).child(div().font_family(MONO).text_color(t.ansi1).child(`−${pr.deletions}`))
      .child(`· ${pr.files} files · updated ${ago(pr.updatedAt)}`))
    .child(div().mx(-6).child(anchored(view, t, "pr-labels", labelTrigger)))
    .when(Boolean(merge), (e) => e.child(h_flex().mt(4).px(8).py(6).gap(8).items_start().rounded(7).bg(t.raised)
      .child(div().mt(2).flex_none().child(icon(merge.icon, merge.color, 14)))
      .child(div().flex_1().min_w(0).text_color(merge.color).child(merge.sentence))
      .when(Boolean(mergeAction), (el) => el.child(mergeAction))));

  const checks = v_flex().px(8).py(12)
    .child(section("Checks", pr.ci.total ? `${pr.ci.pass}/${pr.ci.total}` : "none",
      failedRuns.length ? [button("pr-rerun", "Rerun failed", "R", rerun, { busy: isPending(view, scope, "rerun") })] : []))
    .children(failing.map(checkRow))
    .when(view.showPassed, (e) => e.children(passed.map((c, i) => checkRow(c, failing.length + i))))
    .when(passed.length > 0, (e) => e.child(row("checks-toggle", [
      icon("ok", t.ansi2), div().text_color(t.muted).child(view.showPassed ? "Hide passed" : `${passed.length} passed or skipped`),
    ]).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { view.showPassed = !view.showPassed; cx.notify(); })));

  const reviewHeader = section("Reviews", DECISION[pr.review] ?? (pr.state === "draft" ? "draft" : null), open_ ? [
    anchored(view, t, "reviewers", button("pr-reviewers", "Request", "r", reviewers, { busy: isPending(view, scope, "requested") })
      .when(view.picker?.field === "reviewers", (el) => el.bg(t.selected))),
  ] : []);
  const reviews = v_flex().px(8).py(12)
    .child(reviewHeader)
    .children(pr.reviews.map((r, i) => {
      const [name, color, label] = REVIEW[r.state] ?? REVIEW.COMMENTED;
      return row(`review-${i}`, [avatar(t, r.login, 16), div().flex_1().truncate().child(r.login), icon(name, t[color]), div().text_size(11.5).text_color(t.dim).child(label)]);
    }))
    .children(pr.requested.map((login, i) => row(`requested-${i}`, [avatar(t, login, 16), div().flex_1().truncate().text_color(t.muted).child(login), icon("waiting", t.dim), div().text_size(11.5).text_color(t.dim).child("requested")])))
    .when(!pr.reviews.length && !pr.requested.length, (e) => e.child(div().px(6).text_size(12).text_color(t.dim).child("No reviewers yet")));

  view.keymap = [
    { key: "r", run: reviewers, off: !open_ },
    { key: "l", run: labels },
    { key: "d", label: pr.state === "draft" ? "ready" : "draft", hint: open_, run: toggleDraft, off: !open_ },
    { key: "R", label: "rerun failed", hint: failedRuns.length > 0, run: rerun },
    { key: "m", label: "merge", hint: pr.state === "open" && Boolean(pr.merge?.ok), run: mergeIt },
    { key: "c", label: "comment", hint: true, run: (cx) => openComposer(view, cx) },
    { key: "o", label: "open", hint: true, run: () => open(pr.url) },
  ];

  const thread = view.prComments?.url === pr.url ? view.prComments : null;
  const list = thread?.list ?? [];
  const conversation = v_flex().px(14).pt(12).pb(10).gap(14)
    .child(h_flex().gap(6).items_center().text_size(11).text_color(t.muted)
      .child(div().font_semibold().child("CONVERSATION")).when(list.length > 0, (el) => el.child(div().text_color(t.dim).child(String(list.length))))
      .when(Boolean(thread?.loading), (el) => el.child(spinner(t, 11))))
    .when(Boolean(thread?.error), (el) => el.child(div().text_size(12).text_color(t.ansi1).child(`GitHub: ${thread.error}`)))
    .when(Boolean(thread) && !thread.loading && !thread.error && !list.length, (el) => el.child(div().text_size(12).text_color(t.dim).child("No comments yet")))
    .children(list.map((c) => commentCard(view, t, { id: c.id, who: c.who, at: c.createdAt, body: c.body })));

  const send = async (text) => {
    await gh.comment(work, pr, text);
    if (view.prComments?.url === pr.url) {
      view.prComments.list = [...(view.prComments.list ?? []), { id: `local-${Date.now()}`, who: "You", body: text, createdAt: new Date().toISOString() }];
      view.prComments.at = 0;
    }
  };

  return panelShell(view, t, { header, body: v_flex().w_full().child(top).child(checks).child(reviews).child(conversation)
    .child(composer(view, t, { label: `Comment on #${pr.number}…`, send })) });
}

// The thread loads when the panel shows its PR, and again a minute later or after a comment.
export function loadComments(view, cx, work, pr) {
  const now = view.prComments;
  if (now?.url === pr.url && (now.loading || Date.now() - now.at < 60000)) return;
  const thread = { url: pr.url, at: Date.now(), loading: true, error: null, list: now?.url === pr.url ? now.list : null };
  view.prComments = thread;
  cx.spawn(async (cx) => {
    try { thread.list = await gh.comments(work, pr); }
    catch (e) { thread.error = String(e?.message ?? e); }
    finally { thread.loading = false; thread.at = Date.now(); cx.notify(); }
  });
}
