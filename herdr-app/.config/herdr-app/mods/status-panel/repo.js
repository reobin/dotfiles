import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { theme, shared } from "herdr";
import { MONO, REPOS, REPO_SHOWN, target, shown, ago, open } from "./look.js";
import { panelShell, icon, refreshButton } from "./panel.js";

// The README's relative links and images point into the repo, not the app.
function absolute(readme, info) {
  const branch = info.defaultBranchRef?.name ?? "HEAD";
  return readme.replace(/(!?)\[([^\]]*)\]\((?!https?:|#|mailto:)\.?\/?([^)\s]+)([^)]*)\)/g, (_m, bang, text, path, rest) =>
    `${bang}[${text}](${bang ? `https://raw.githubusercontent.com/${info.nameWithOwner}/${branch}` : `${info.url}/blob/${branch}`}/${path}${rest})`);
}

export function renderRepo(view) {
  const t = theme();
  const space = shown();
  const work = space ? target(space) : null;
  const at = shared(REPO_SHOWN);
  const slug = work && at?.key === work.key ? at.slug : null;
  const data = slug ? (shared(REPOS) ?? {})[slug] ?? null : null;
  const info = data?.info;
  const refreshing = shared("status-tabs.refreshing");
  const busy = Boolean(slug && Array.isArray(refreshing) && refreshing.includes(`repo:${slug}`));
  view.keymap = [];

  const header = h_flex().h(34).flex_none().px(14).gap(8).items_center().rounded_t(11).bg(t.accent + "14")
    .child(icon("repo", t.dim, 14))
    .child(div().min_w(0).truncate().font_family(MONO).font_semibold().child(slug ?? "repository"))
    .when(Boolean(info?.visibility), (e) => e.child(div().flex_none().px(7).rounded(9).text_size(10.5).font_semibold().bg(t.raised).text_color(t.muted)
      .child(info.isArchived ? "archived" : info.visibility.toLowerCase())))
    .child(div().flex_1())
    .child(refreshButton(view, t, null, { loading: busy }))
    .when(Boolean(info), (e) => e.child(h_flex().id("repo-open").gap(4).items_center().px(6).py(2).rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => open(info.url)).child(icon("link")).child("GitHub")));

  if (!info) {
    const note = !space ? "no space" : !slug ? "this space's folder is not a GitHub checkout and has no PR" : data?.error ? `GitHub: ${data.error}` : "loading…";
    return panelShell(view, t, { header, body: div().p(14).text_color(data?.error ? t.ansi1 : t.dim).child(note) });
  }

  const branch = info.defaultBranchRef?.name;
  const top = v_flex().px(14).pt(12).pb(12).gap(6)
    .when(Boolean(info.description), (e) => e.child(div().text_size(12.5).child(info.description)))
    .child(h_flex().gap(6).text_size(11.5).text_color(t.muted)
      .when(Boolean(branch), (e) => e.child(div().font_family(MONO).text_color(t.foreground).child(branch)).child("·"))
      .child(`pushed ${ago(info.pushedAt)}`)
      .when(info.stargazerCount > 0, (e) => e.child(`· ${info.stargazerCount} ★`)))
    .when(Number.isInteger(data.openPulls), (e) => e.child(h_flex().id("repo-pulls").gap(6).items_center().self_start().mx(-6).px(6).py(2).rounded(5)
      .cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => open(`${info.url}/pulls`)).text_size(12)
      .child(icon("pr", t.muted)).child(div().font_semibold().child(String(data.openPulls)))
      .child(div().text_color(t.muted).child(`open pull request${data.openPulls === 1 ? "" : "s"}`))))
    .when(Boolean(data.error), (e) => e.child(div().text_size(11.5).text_color(t.ansi1).child(`GitHub: ${data.error}`)));

  const readme = data.readme && v_flex().px(14).pt(12).pb(14)
    .child(div().mb(8).text_size(11).font_semibold().text_color(t.muted).child("README"))
    .child(div().text_size(12.5).child(TextView.markdown(`readme-${slug}`, absolute(data.readme, info)).selectable(true).on_link_click((u) => open(u))));

  view.keymap = [
    { key: "o", label: "open", hint: true, run: () => open(info.url) },
    { key: "p", label: "pulls", hint: true, run: () => open(`${info.url}/pulls`) },
  ];

  return panelShell(view, t, { header, body: v_flex().w_full().child(top).when(Boolean(readme), (e) => e.child(readme)) });
}
