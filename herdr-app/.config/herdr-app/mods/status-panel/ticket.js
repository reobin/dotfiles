import { div, svg } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { spaces, theme, run } from "herdr";
import { ICONS, entryFor, target, ticketIcon, open } from "./look.js";
import { panelShell } from "./panel.js";

const KEY_HINT = "Set LINEAR_API_KEY, or save a Linear personal API key in ~/.config/linear/api-key, for status and details.";

export function renderTicket(view) {
  const t = theme();
  const space = spaces().find((s) => s.active);
  const work = space ? target(space) : null;
  const current = entryFor(work);
  const ticket = current?.ticket;
  const issue = ticket?.issue;
  const icon = (name, color, size = 12) => { const el = svg(`${ICONS}/${name}.svg`).size(size).flex_none(); return color ? el.text_color(color) : el; };
  const section = (title) => div().mb(6).text_size(11).font_semibold().text_color(t.muted).child(title.toUpperCase());
  const chip = (text, color) => div().px(6).rounded(5).bg((color ?? t.foreground) + "1f").text_size(11).text_color(t.muted).child(text);
  const url = issue?.url ?? null;

  const header = h_flex().h(42).flex_none().px(14).gap(8).items_center()
    .when(Boolean(ticket), (e) => e.child(icon(ticketIcon(ticket), issue?.state?.color ?? t.dim, 14)).child(div().font_semibold().child(ticket.id)))
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
  const prop = (label, value) => h_flex().gap(10).items_center().min_h(22)
    .child(div().w(76).flex_none().text_color(t.muted).child(label)).child(h_flex().flex_1().min_w(0).gap(6).items_center().children(value));
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

  const props = v_flex().px(14).py(12).gap(2)
    .child(prop("Status", [icon(ticketIcon(ticket), issue.state.color), div().child(issue.state.name)]))
    .child(prop("Priority", [div().child(issue.priorityLabel || "No priority")]))
    .child(prop("Assignee", [div().truncate().child(issue.assignee?.displayName ?? issue.assignee?.name ?? "Unassigned")]))
    .when(Boolean(issue.project), (e) => e.child(prop("Project", [div().truncate().child(issue.project.name)])))
    .when(Boolean(issue.cycle), (e) => e.child(prop("Cycle", [div().child(issue.cycle.name || `Cycle ${issue.cycle.number}`)])))
    .when(issue.labels.nodes.length > 0, (e) => e.child(prop("Labels", issue.labels.nodes.map((l) => chip(l.name, l.color)))));

  const linked = v_flex().px(14).py(12)
    .child(section("Linked PRs"))
    .children(prs.map((a, i) => h_flex().id(`ticket-pr-${i}`).h(24).px(6).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(() => open(a.url))
      .child(icon("pr", t.muted)).child(div().flex_1().min_w(0).truncate().child(a.title || a.url))));

  return panelShell(view, t, { header, body: body
    .child(props)
    .when(prs.length > 0, (e) => e.child(linked))
    .child(v_flex().px(14).py(12)
      .child(section("Description"))
      .child(issue.description?.trim()
        ? TextView.markdown("ticket-body", issue.description).selectable(true).on_link_click((u) => open(u))
        : div().text_color(t.dim).child("No description"))) });
}
