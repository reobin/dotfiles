import { div, svg } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { run, focused, panes, terminals, spaces, shared } from "herdr";
import { ICONS, SANS, MONO, ago, open } from "./look.js";
import { avatar } from "./picker.js";

// pane.go gives a panel the keyboard; global keys still scroll it from a terminal.
const STEP = 160, LINE = 40;
const SPINNER = "mods/workspace-chrome/spinner.svg";

export function initPanel(view, name, cx) {
  view.panelName = name;
  view.offset = 0;
  view.handle = cx.focus_handle();
  view.keymap = [];
  view.commentH = {};
  view.expanded = new Set();
}

const maxOffset = (view) => Math.max(0, (view.contentH ?? 0) - (view.viewH ?? 0));

function scrollTo(view, offset, cx) {
  const next = Math.min(maxOffset(view), Math.max(0, offset));
  if (next !== view.offset) { view.offset = next; cx.notify(); }
}

export const hasKeyboard = (view) => view.handle.is_focused();

// status-tabs sends this as it shows the panel, a frame before the panel has drawn and
// can hold the keyboard: try each frame until it does.
function grab(view, cx, tries) {
  if (hasKeyboard(view)) return;
  focusPanel(view);
  cx.notify();
  if (tries > 0) cx.timer.after(16, (cx) => grab(view, cx, tries - 1));
}

// Where Esc sends the keyboard back to: whatever had it before the panel took it.
function remember(view) {
  if (hasKeyboard(view)) return;
  const f = focused();
  if (f?.pane || f?.terminal) view.returnTo = { pane: f.pane, terminal: f.terminal };
}

export function focusPanel(view) {
  remember(view);
  view.handle.focus();
}

function activeTab() {
  return spaces().find((s) => s.active)?.tabs.find((t) => t.active)?.id ?? null;
}

export function closePanel(view) {
  const back = view.returnTo, tab = activeTab();
  view.returnTo = null;
  const pane = back?.pane && panes().find((p) => p.pane === back.pane && p.tab === tab);
  const term = !pane && back?.terminal && terminals().some((x) => x.address === back.terminal)
    && panes().find((p) => p.terminal === back.terminal && p.tab === tab);
  const fallback = panes().find((p) => p.tab === tab && p.terminal);
  const to = pane || term || fallback;
  // Over an empty view or the archive the panes are hidden; empty-view takes the keyboard back.
  if (to && !shared("tree.empty")) run("pane.focus", { pane: to.pane });
  run("layout.hide", { id: "panel" });
}

export function panelCommand(view, command, cx) {
  const name = view.panelName;
  if (command === "focus") focusPanel(view);
  else if (command === `focus-${name}`) grab(view, cx, 10);
  else if (command === `toggle-${name}`) { if (hasKeyboard(view)) closePanel(view); else focusPanel(view); }
  else if (command === "scroll-down") scrollTo(view, view.offset + STEP, cx);
  else if (command === "scroll-up") scrollTo(view, view.offset - STEP, cx);
  else if (command === "escape") escape(view);
  cx.notify();
}

// Esc arrives as a key and as the mod's key binding: one press, one close.
function escape(view) {
  const now = Date.now();
  if (now - (view.escAt ?? 0) < 150) return;
  view.escAt = now;
  closePanel(view);
}

function panelKey(view, e, cx) {
  const m = e.modifiers;
  if (m.platform || m.control || m.alt) return;
  const k = m.shift && /^[a-z]$/.test(e.key) ? e.key.toUpperCase() : e.key;
  if (k === "j" || k === "down") scrollTo(view, view.offset + LINE, cx);
  else if (k === "k" || k === "up") scrollTo(view, view.offset - LINE, cx);
  else if (k === "space") scrollTo(view, view.offset + (m.shift ? -1 : 1) * (view.viewH ?? STEP), cx);
  else if (k === "g" || k === "G") scrollTo(view, k === "G" ? maxOffset(view) : 0, cx);
  else if (k === "escape" || k === "q") escape(view);
  else if (k === "r") view.refresh(cx);
  else {
    const action = view.keymap.find((a) => a.key === k && !a.off);
    if (!action) return;
    action.run(cx);
  }
  cx.stop_propagation();
}

export function kbd(t, key) {
  return div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(key);
}

export const spinner = (t, size = 12) => svg(SPINNER).size(size).flex_none().text_color(t.dim).spin(900);

export const icon = (name, color, size = 12) => { const el = svg(`${ICONS}/${name}.svg`).size(size).flex_none(); return color ? el.text_color(color) : el; };

export function refreshButton(view, t, work, thread) {
  const refreshing = shared("status-tabs.refreshing");
  const busy = (work && Array.isArray(refreshing) && refreshing.includes(work.key)) || thread?.loading;
  view.refresh = (cx) => {
    if (thread && !thread.loading) thread.at = 0;
    run("status-tabs.refresh");
    cx.notify();
  };
  return div().id(`${view.panelName}-refresh`).p(4).rounded(5).cursor_pointer().text_color(t.dim)
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(busy ? "refreshing…" : "refresh (r)")
    .on_click((_e, cx) => view.refresh(cx)).child(busy ? spinner(t) : icon("refresh"));
}

const stop = (_e, cx) => cx.stop_propagation();

function footer(view, t) {
  const hints = view.keymap.filter((a) => a.hint);
  return h_flex().flex_none().px(14).py(8).gap(14).flex_wrap().text_size(11).text_color(t.dim)
    .children([...hints, { key: "esc", label: "close" }].map((a) => h_flex().gap(4).items_center().child(kbd(t, a.key)).child(a.label)));
}

export function panelShell(view, t, { header, body }) {
  const max = maxOffset(view);
  view.offset = Math.min(view.offset, max);
  const name = view.panelName;

  return v_flex().id(`${name}-panel`).size_full().min_h(0).rounded(12).overflow_hidden().bg(t.background)
    .border_1().border_color(t.background).font_family(SANS).text_color(t.foreground).text_size(13)
    .track_focus(view.handle).focus((s) => s.border_color(t.accent)).on_key_down((e, cx) => panelKey(view, e, cx))
    .on_mouse_down("left", () => focusPanel(view))
    .child(header)
    .child(div().id(`${name}-view`).flex_1().min_h(0).relative().overflow_hidden()
      .on_size_change((s, cx) => { if (s.height !== view.viewH) { view.viewH = s.height; cx.notify(); } })
      .on_scroll_wheel((e, cx) => scrollTo(view, view.offset - e.delta.y, cx))
      .child(div().id(`${name}-content`).absolute().left(0).right(0).top(-view.offset)
        .on_size_change((s, cx) => { if (s.height !== view.contentH) { view.contentH = s.height; cx.notify(); } })
        .child(body))
      .when(max > 0, (e) => e.child(div().absolute().right(2).w(3).rounded(2).bg(t.border)
        .top((view.offset / view.contentH) * view.viewH).h((view.viewH / view.contentH) * view.viewH))))
    .child(footer(view, t));
}

const CLAMP = 168;

// Long comments (bots post whole reports) fold to a few lines until asked.
export function commentCard(view, t, { id, who, at, body, reply }) {
  const long = (view.commentH[id] ?? 0) > CLAMP + 36, open_ = view.expanded.has(id);
  const text = div().id(`cbody-${id}`).flex_none().w_full()
    .on_size_change((s, cx) => { if (Math.abs((view.commentH[id] ?? 0) - s.height) > 1) { view.commentH[id] = s.height; cx.notify(); } })
    .child(TextView.markdown(`comment-${id}`, body || "_No text_").selectable(true).on_link_click((u) => open(u)));
  return v_flex().gap(4).when(reply, (el) => el.ml(9).pl(12).border_l(1).border_color(t.border))
    .child(h_flex().gap(7).items_center().text_size(12)
      .child(avatar(t, who, 18)).child(div().font_semibold().truncate().child(who)).child(div().flex_none().text_color(t.dim).child(ago(at))))
    .child(div().pl(25).text_size(12.5).when(long && !open_, (el) => el.max_h(CLAMP).overflow_hidden()).child(text))
    .when(long, (el) => el.child(div().id(`cmore-${id}`).ml(25).text_size(11.5).text_color(t.muted).cursor_pointer()
      .hover((s) => s.text_color(t.foreground)).on_mouse_down("left", stop)
      .on_click((_e, cx) => { if (open_) view.expanded.delete(id); else view.expanded.add(id); cx.notify(); })
      .child(open_ ? "show less" : "show more")));
}
