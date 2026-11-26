import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { theme } from "herdr";
import { MONO, entryFor, target, shown, ticketIcon, stateIcon, open } from "./look.js";
import { panelShell, icon, commentCard, refreshButton } from "./panel.js";
import { avatar, hex } from "./picker.js";

const KEY_HINT = "set LINEAR_API_KEY, or save a Linear personal API key in ~/.config/linear/api-key, for status and details.";
// Linear's priority values, 0 to 4.
const PRIORITIES = [["no priority", "prio-none"], ["urgent", "prio-urgent"], ["high", "prio-high"], ["medium", "prio-medium"], ["low", "prio-low"]];

const personName = (p) => p?.displayName ?? p?.name ?? null;

// Read-only: changes to a ticket go through an agent or Linear.
export function renderTicket(view) {
  const t = theme();
  const space = shown();
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const ticket = current?.ticket;
  const issue = ticket?.issue;
  const section = (title) => div().mb(6).text_size(11).font_semibold().text_color(t.muted).child(title);
  const chip = (text, color) => h_flex().px(6).gap(5).items_center().rounded(5).bg((hex(color) ?? t.foreground) + "1f").text_size(11).text_color(t.muted)
    .when(Boolean(color), (el) => el.child(div().size(6).rounded(3).bg(hex(color)))).child(text);
  const url = issue?.url ?? null;
  view.keymap = [];

  const header = h_flex().h(34).flex_none().px(14).gap(8).items_center().rounded_t(11).bg(t.accent + "14")
    .when(Boolean(ticket), (e) => e.child(icon(ticketIcon(ticket), issue?.state?.color ?? t.dim, 14)).child(div().font_family(MONO).font_semibold().child(ticket.id)))
    .when(!ticket, (e) => e.child(div().font_semibold().child("ticket")))
    .child(div().flex_1())
    .child(refreshButton(view, t, work, null))
    .when(Boolean(url), (e) => e.child(h_flex().id("ticket-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(url)).child(icon("link")).child("Linear")));

  if (!ticket) {
    const note = !space ? "no space" : !current ? "loading…" : `no ticket found for ${work.branch ?? "this space"}`;
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

  const { state, assignee } = issue;
  const labels = issue.labels.nodes, comments = issue.comments?.nodes ?? [];
  const [prioName, prioIcon] = PRIORITIES[issue.priority] ?? PRIORITIES[0];
  const prop = (label, value) => h_flex().gap(4).items_center().min_h(26)
    .child(div().w(70).flex_none().text_color(t.muted).child(label))
    .child(h_flex().flex_1().min_w(0).px(6).gap(6).items_center().children(value));

  const props = v_flex().px(8).py(10).gap(1).pl(14)
    .child(prop("status", [icon(stateIcon(state), state?.color, 13), div().truncate().child(state?.name ?? "—")]))
    .child(prop("priority", [icon(prioIcon, issue.priority === 1 ? t.ansi3 : t.muted, 13), div().child(prioName)]))
    .child(prop("assignee", assignee
      ? [avatar(t, personName(assignee), 16), div().truncate().child(personName(assignee))]
      : [icon("user", t.dim, 14), div().text_color(t.dim).child("unassigned")]))
    .when(labels.length > 0, (e) => e.child(prop("labels", [h_flex().flex_1().min_w(0).gap(4).flex_wrap().py(4).children(labels.map((l) => chip(l.name, l.color)))])))
    .when(Boolean(issue.project), (e) => e.child(prop("project", [div().truncate().child(issue.project.name)])))
    .when(Boolean(issue.cycle), (e) => e.child(prop("cycle", [div().child(issue.cycle.name || `cycle ${issue.cycle.number}`)])));

  const linked = v_flex().px(14).py(12)
    .child(section("linked PRs"))
    .children(prs.map((a, i) => h_flex().id(`ticket-pr-${i}`).h(24).px(6).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(() => open(a.url))
      .child(icon("pr", t.muted)).child(div().flex_1().min_w(0).truncate().child(a.title || a.url))));

  const replies = new Map();
  for (const c of comments) if (c.parent?.id) replies.set(c.parent.id, [...(replies.get(c.parent.id) ?? []), c]);
  const byTime = (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const threads = comments.filter((c) => !c.parent?.id).sort(byTime);
  const commentView = (c, reply) => commentCard(view, t,
    { id: c.id, who: personName(c.user) ?? c.botActor?.name ?? "someone", at: c.createdAt, body: c.body, reply });
  const discussion = v_flex().px(14).pt(12).pb(10).gap(14)
    .child(h_flex().gap(6).items_center().child(section("activity")).when(comments.length > 0, (el) => el.child(div().mb(6).text_size(11).text_color(t.dim).child(String(comments.length)))))
    .children(threads.map((c) => v_flex().gap(10).child(commentView(c, false)).children((replies.get(c.id) ?? []).sort(byTime).map((r) => commentView(r, true)))));

  view.keymap = [{ key: "o", label: "open", hint: true, run: () => open(url) }];

  return panelShell(view, t, { header, body: body
    .child(props)
    .when(prs.length > 0, (e) => e.child(linked))
    .child(v_flex().px(14).py(12)
      .child(section("description"))
      .child(issue.description?.trim()
        ? TextView.markdown("ticket-body", issue.description).selectable(true).on_link_click((u) => open(u))
        : div().text_color(t.dim).child("no description")))
    .child(discussion) });
}
