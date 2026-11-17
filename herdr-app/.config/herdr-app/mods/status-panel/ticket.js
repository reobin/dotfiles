import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { spaces, theme, run } from "herdr";
import { MONO, entryFor, target, ticketIcon, open } from "./look.js";
import { panelShell, act, valueOf, isPending, say, kbd, spinner, icon, composer, openComposer, focusPanel, commentCard } from "./panel.js";
import { openPicker, anchored, avatar, hex } from "./picker.js";
import * as linear from "./linear.js";

const KEY_HINT = "Set LINEAR_API_KEY, or save a Linear personal API key in ~/.config/linear/api-key, for status and details.";

const personName = (p) => p?.displayName ?? p?.name ?? null;
const stateIcon = (state) => ticketIcon({ issue: { state } });

export function renderTicket(view) {
  const t = theme();
  const space = spaces().find((s) => s.active);
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const ticket = current?.ticket;
  const issue = ticket?.issue;
  const section = (title) => div().mb(6).text_size(11).font_semibold().text_color(t.muted).child(title.toUpperCase());
  const chip = (text, color) => h_flex().px(6).gap(5).items_center().rounded(5).bg((hex(color) ?? t.foreground) + "1f").text_size(11).text_color(t.muted)
    .when(Boolean(color), (el) => el.child(div().size(6).rounded(3).bg(hex(color)))).child(text);
  const url = issue?.url ?? null;
  view.keymap = [];

  const header = h_flex().h(42).flex_none().px(14).gap(8).items_center()
    .when(Boolean(ticket), (e) => e.child(icon(ticketIcon(ticket), issue?.state?.color ?? t.dim, 14)).child(div().font_family(MONO).font_semibold().child(ticket.id)))
    .when(!ticket, (e) => e.child(div().font_semibold().child("Ticket")))
    .child(div().flex_1())
    .child(div().id("ticket-refresh").p(4).rounded(5).cursor_pointer().text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("status-tabs.refresh")).child(icon("refresh")))
    .when(Boolean(url), (e) => e.child(h_flex().id("ticket-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(url)).child(icon("link")).child("Linear")));

  if (!ticket) {
    const note = !space ? "No space" : !current ? "Loading…" : `No ticket found for ${work.branch ?? "this space"}`;
    return panelShell(view, t, { header, body: div().p(14).text_color(t.dim).child(note) });
  }

  const title = issue?.title ?? (current.pr?.title ?? "");
  const prs = (issue?.attachments?.nodes ?? []).filter((a) => /github\.com\/.+\/pull\/\d+/.test(a.url));

  const top = v_flex().px(14).pt(12).pb(12).gap(6)
    .when(Boolean(title), (e) => e.child(div().text_size(14).font_semibold().child(title)))
    .child(h_flex().gap(5).items_center().flex_wrap().text_size(11).text_color(t.dim)
      .child("found via").child(chip(ticket.sources[0]))
      .when(ticket.sources.length > 1, (e) => e.child("· confirmed by").children(ticket.sources.slice(1).map((s) => chip(s)))));

  const body = v_flex().w_full().child(top);

  if (!issue) {
    const note = ticket.linear === "nokey" ? KEY_HINT
      : ticket.linear === "missing" ? `Linear has no issue ${ticket.id}.`
      : `Linear: ${ticket.linearError ?? "unavailable"}`;
    return panelShell(view, t, { header, body: body.child(div().px(14).py(12).text_size(12).text_color(t.dim).child(note)) });
  }

  // Entries cached before the panel could edit have no ids: they edit after the next refresh.
  const scope = issue.id ?? ticket.id, team = issue.team?.id, editable = Boolean(issue.id && team);
  const state = valueOf(view, scope, "state", issue.state);
  const assignee = valueOf(view, scope, "assignee", issue.assignee);
  const priority = valueOf(view, scope, "priority", issue.priority);
  const labels = valueOf(view, scope, "labels", issue.labels.nodes);
  const comments = valueOf(view, scope, "comments", issue.comments?.nodes ?? []);
  const update = (field, value, input, ok) => (cx) => act(view, cx, { scope, field, value, ok, task: () => linear.updateIssue(issue.id, input) });

  const pickers = {
    state: (cx) => openPicker(view, cx, {
      field: "state", placeholder: "Change status…",
      load: async () => (await linear.states(team)).map((s) => ({ key: s.id, label: s.name, icon: stateIcon(s), color: s.color, value: s })),
      checked: (it) => it.key === state?.id,
      choose: (it, cx) => { if (it.key !== state?.id) update("state", it.value, { stateId: it.key }, `Status set to ${it.label}`)(cx); },
    }),
    assignee: (cx) => openPicker(view, cx, {
      field: "assignee", placeholder: "Assign to…",
      load: async () => [{ key: null, label: "Unassigned", icon: "user" },
        ...(await linear.members(team)).map((m) => ({ key: m.id, label: m.displayName || m.name, sub: m.displayName && m.name !== m.displayName ? m.name : null, person: true, value: m }))],
      checked: (it) => (it.key ?? null) === (assignee?.id ?? null),
      choose: (it, cx) => {
        if ((it.key ?? null) === (assignee?.id ?? null)) return;
        update("assignee", it.value ?? null, { assigneeId: it.key }, it.key ? `Assigned to ${it.label}` : "Unassigned")(cx);
      },
    }),
    priority: (cx) => openPicker(view, cx, {
      field: "priority", placeholder: "Set priority…",
      load: async () => linear.PRIORITIES.map((p) => ({ key: p.value, label: p.name, icon: p.icon, color: p.value === 1 ? t.ansi3 : t.muted })),
      checked: (it) => it.key === priority,
      choose: (it, cx) => { if (it.key !== priority) update("priority", it.key, { priority: it.key }, `Priority set to ${it.label}`)(cx); },
    }),
    labels: (cx) => openPicker(view, cx, {
      field: "labels", placeholder: "Add or remove labels…", multi: true,
      load: async () => (await linear.labels(team)).map((l) => ({ key: l.id, label: l.name, sub: l.parent?.name ?? null, dot: l.color, value: l })),
      checked: (it) => valueOf(view, scope, "labels", issue.labels.nodes).some((l) => l.id === it.key),
      choose: (it, cx) => {
        const now = valueOf(view, scope, "labels", issue.labels.nodes);
        const on = now.some((l) => l.id === it.key);
        const next = on ? now.filter((l) => l.id !== it.key) : [...now, { id: it.key, name: it.label, color: it.value.color }];
        update("labels", next, { labelIds: next.map((l) => l.id) })(cx);
      },
    }),
  };

  const assignMe = (cx) => cx.spawn(async (cx) => {
    try {
      const me = await linear.viewer();
      if (assignee?.id === me.id) return say(view, cx, "Already assigned to you");
      update("assignee", me, { assigneeId: me.id }, "Assigned to you")(cx);
    } catch (e) { say(view, cx, String(e?.message ?? e), "error"); }
  });

  const prop = (field, label, key, value) => {
    const button = h_flex().id(`prop-${field}`).flex_1().min_w(0).h(26).px(6).gap(6).items_center().rounded(6)
      .when(view.picker?.field === field, (el) => el.bg(t.selected))
      .when(editable, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { focusPanel(view); pickers[field](cx); }))
      .children(value)
      .child(div().flex_1())
      .when(isPending(view, scope, field), (el) => el.child(spinner(t)))
      .when(editable, (el) => el.child(kbd(t, key)));
    return h_flex().gap(4).items_center().min_h(26)
      .child(div().w(70).flex_none().text_color(t.muted).child(label))
      .child(anchored(view, t, field, button));
  };

  const prio = linear.PRIORITIES.find((p) => p.value === priority) ?? linear.PRIORITIES[0];
  const props = v_flex().px(8).py(10).gap(1).pl(14)
    .child(prop("state", "Status", "s", [icon(stateIcon(state), state?.color, 13), div().truncate().child(state?.name ?? "—")]))
    .child(prop("priority", "Priority", "p", [icon(prio.icon, prio.value === 1 ? t.ansi3 : t.muted, 13), div().child(prio.value ? prio.name : "No priority")]))
    .child(prop("assignee", "Assignee", "a", assignee
      ? [avatar(t, personName(assignee), 16), div().truncate().child(personName(assignee))]
      : [icon("user", t.dim, 14), div().text_color(t.dim).child("Unassigned")]))
    .child(prop("labels", "Labels", "l", labels.length
      ? [h_flex().flex_1().min_w(0).gap(4).flex_wrap().py(4).children(labels.map((l) => chip(l.name, l.color)))]
      : [icon("tag", t.dim, 13), div().text_color(t.dim).child("Add labels")]))
    .when(Boolean(issue.project), (e) => e.child(h_flex().gap(4).items_center().min_h(26).child(div().w(70).flex_none().text_color(t.muted).child("Project"))
      .child(div().px(6).truncate().child(issue.project.name))))
    .when(Boolean(issue.cycle), (e) => e.child(h_flex().gap(4).items_center().min_h(26).child(div().w(70).flex_none().text_color(t.muted).child("Cycle"))
      .child(div().px(6).child(issue.cycle.name || `Cycle ${issue.cycle.number}`))));

  const linked = v_flex().px(14).py(12)
    .child(section("Linked PRs"))
    .children(prs.map((a, i) => h_flex().id(`ticket-pr-${i}`).h(24).px(6).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(() => open(a.url))
      .child(icon("pr", t.muted)).child(div().flex_1().min_w(0).truncate().child(a.title || a.url))));

  const replies = new Map();
  for (const c of comments) if (c.parent?.id) replies.set(c.parent.id, [...(replies.get(c.parent.id) ?? []), c]);
  const byTime = (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const threads = comments.filter((c) => !c.parent?.id).sort(byTime);
  const commentView = (c, reply) => commentCard(view, t,
    { id: c.id, who: personName(c.user) ?? c.botActor?.name ?? "Someone", at: c.createdAt, body: c.body, reply });
  const discussion = v_flex().px(14).pt(12).pb(10).gap(14)
    .child(h_flex().gap(6).items_center().child(section("Activity")).when(comments.length > 0, (el) => el.child(div().mb(6).text_size(11).text_color(t.dim).child(String(comments.length)))))
    .children(threads.map((c) => v_flex().gap(10).child(commentView(c, false)).children((replies.get(c.id) ?? []).sort(byTime).map((r) => commentView(r, true)))));

  view.keymap = [
    { key: "s", run: pickers.state, off: !editable },
    { key: "a", run: pickers.assignee, off: !editable },
    { key: "i", label: "assign me", hint: true, run: assignMe, off: !editable },
    { key: "p", run: pickers.priority, off: !editable },
    { key: "l", run: pickers.labels, off: !editable },
    { key: "c", label: "comment", hint: true, run: (cx) => openComposer(view, cx), off: !issue.id },
    { key: "o", label: "open", hint: true, run: () => open(url) },
  ];

  const send = async (text) => {
    await linear.comment(issue.id, text);
    const mine = { id: `local-${Date.now()}`, body: text, createdAt: new Date().toISOString(), user: { displayName: "You" } };
    view.over[`${scope}:comments`] = { value: [...comments, mine], pending: false, until: Date.now() + 20000 };
  };

  return panelShell(view, t, { header, body: body
    .child(props)
    .when(prs.length > 0, (e) => e.child(linked))
    .child(v_flex().px(14).py(12)
      .child(section("Description"))
      .child(issue.description?.trim()
        ? TextView.markdown("ticket-body", issue.description).selectable(true).on_link_click((u) => open(u))
        : div().text_color(t.dim).child("No description")))
    .child(discussion)
    .when(Boolean(issue.id), (e) => e.child(composer(view, t, { label: "Leave a comment…", send }))) });
}
