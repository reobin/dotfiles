import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run } from "herdr";

// pane.go gives a panel the keyboard; global keys still scroll it from a terminal.
const STEP = 160, LINE = 40;

export function initPanel(view, name, cx) {
  view.panelName = name;
  view.offset = 0;
  view.handle = cx.focus_handle();
}

const maxOffset = (view) => Math.max(0, (view.contentH ?? 0) - (view.viewH ?? 0));

function scrollTo(view, offset, cx) {
  const next = Math.min(maxOffset(view), Math.max(0, offset));
  if (next !== view.offset) { view.offset = next; cx.notify(); }
}

export function panelCommand(view, command, cx) {
  if (command === "focus") { view.handle.focus(); cx.notify(); }
  else if (command === "scroll-down") scrollTo(view, view.offset + STEP, cx);
  else if (command === "scroll-up") scrollTo(view, view.offset - STEP, cx);
}

function panelKey(view, e, cx) {
  if (e.modifiers.platform || e.modifiers.control || e.modifiers.alt) return;
  const k = e.key;
  if (k === "j" || k === "down") scrollTo(view, view.offset + LINE, cx);
  else if (k === "k" || k === "up") scrollTo(view, view.offset - LINE, cx);
  else if (k === "space") scrollTo(view, view.offset + (e.modifiers.shift ? -1 : 1) * (view.viewH ?? STEP), cx);
  else if (k === "g") scrollTo(view, e.modifiers.shift ? maxOffset(view) : 0, cx);
  else if (k === "escape") run("pane.go", { direction: "left" });
  else return;
  cx.stop_propagation();
}

export function panelShell(view, t, { header, body }) {
  const max = maxOffset(view);
  view.offset = Math.min(view.offset, max);
  const name = view.panelName;

  return v_flex().id(`${name}-panel`).size_full().min_h(0).rounded(12).overflow_hidden().bg(t.background)
    .border_1().border_color(t.background).text_color(t.foreground).text_size(13)
    .track_focus(view.handle).focus((s) => s.border_color(t.accent)).on_key_down((e, cx) => panelKey(view, e, cx))
    .child(header)
    .child(div().id(`${name}-view`).flex_1().min_h(0).relative().overflow_hidden()
      .on_size_change((s, cx) => { if (s.height !== view.viewH) { view.viewH = s.height; cx.notify(); } })
      .on_scroll_wheel((e, cx) => scrollTo(view, view.offset - e.delta.y, cx))
      .child(div().id(`${name}-content`).absolute().left(0).right(0).top(-view.offset)
        .on_size_change((s, cx) => { if (s.height !== view.contentH) { view.contentH = s.height; cx.notify(); } })
        .child(body))
      .when(max > 0, (e) => e.child(div().absolute().right(2).w(3).rounded(2).bg(t.border)
        .top((view.offset / view.contentH) * view.viewH).h((view.viewH / view.contentH) * view.viewH))));
}
