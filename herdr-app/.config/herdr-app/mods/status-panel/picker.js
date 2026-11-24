import { div, svg } from "gpui-kit";
import { v_flex, h_flex, Popup } from "gpui-base";
import { ICONS, MONO } from "./look.js";

// One picker for every field, opened by its key or by clicking the field. Typing filters;
// a single choice applies and closes, a multiple one toggles and stays open.
export function openPicker(view, cx, spec) {
  if (view.picker?.field === spec.field) { view.picker = null; cx.notify(); return; }
  view.confirm = null;
  view.picker = { ...spec, items: null, error: null, query: "", at: 0 };
  const p = view.picker;
  cx.spawn(async (cx) => {
    try {
      p.items = await spec.load();
      const current = p.items.findIndex((it) => spec.checked(it));
      if (!spec.multi && current >= 0) { p.at = current; view.pickScroll.scroll_to_item(current); }
    } catch (e) { p.error = String(e?.message ?? e); }
    cx.notify();
  });
  cx.notify();
}

function rank(label, q) {
  const s = label.toLowerCase();
  if (s.startsWith(q)) return 0;
  if (s.split(/[\s\-_/]+/).some((w) => w.startsWith(q))) return 1;
  if (s.includes(q)) return 2;
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length ? 3 : -1;
}

function shown(p) {
  if (!p.items) return [];
  const q = p.query.trim().toLowerCase();
  if (!q) return p.items;
  return p.items.map((it, i) => ({ it, i, r: rank(`${it.label} ${it.sub ?? ""}`, q) }))
    .filter((x) => x.r >= 0).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it);
}

function choose(view, it, cx) {
  const p = view.picker;
  if (!it || !p) return;
  if (!p.multi) view.picker = null;
  p.choose(it, cx);
  cx.notify();
}

function move(view, by) {
  const p = view.picker, n = shown(p).length;
  if (!n) return;
  p.at = (p.at + by + n) % n;
  view.pickScroll.scroll_to_item(p.at);
}

export function pickerKey(view, e, cx) {
  const p = view.picker, m = e.modifiers, k = e.key;
  cx.stop_propagation();
  if (k === "escape") view.picker = null;
  else if (k === "up" || (m.control && k === "p") || (m.shift && k === "tab")) move(view, -1);
  else if (k === "down" || (m.control && k === "n") || k === "tab") move(view, 1);
  else if (k === "enter") choose(view, shown(p)[p.at], cx);
  else if (k === "backspace") { p.query = m.platform || m.alt ? "" : p.query.slice(0, -1); p.at = 0; }
  else if (!p.query && /^[1-9]$/.test(k) && !m.platform && !m.control) choose(view, shown(p)[+k - 1], cx);
  else if (e.key_char && !m.platform && !m.control) { p.query += e.key_char; p.at = 0; view.pickScroll.scroll_to_item(0); }
  cx.notify();
}

const initials = (name) => (name.match(/\b\p{L}/gu) ?? [name[0] ?? "?"]).slice(0, 2).join("").toUpperCase();

export function avatar(t, name, size = 18) {
  const palette = [t.ansi1, t.ansi2, t.ansi3, t.ansi4, t.ansi5, t.ansi6];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = palette[h % palette.length];
  return div().size(size).flex_none().flex().items_center().justify_center().rounded(size / 2)
    .bg(color + "2e").text_color(color).text_size(size * 0.45).font_semibold().child(initials(name));
}

export const hex = (c) => (c && !c.startsWith("#") ? `#${c}` : c);

function leading(t, it) {
  if (it.icon) return svg(`${ICONS}/${it.icon}.svg`).size(14).flex_none().text_color(it.color ?? t.muted);
  if (it.person) return avatar(t, it.label);
  if (it.dot) return div().w(14).flex_none().flex().justify_center().child(div().size(8).rounded(4).bg(hex(it.dot)));
  return div().w(14).flex_none();
}

const stop = (_e, cx) => cx.stop_propagation();

function menu(view, t) {
  const p = view.picker, items = shown(p);
  p.at = Math.min(p.at, Math.max(0, items.length - 1));
  const row = (it, i) => {
    const on = p.checked(it);
    return h_flex().id(`pick-${p.field}-${i}`).h(28).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer()
      .when(i === p.at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => choose(view, it, cx))
      .child(leading(t, it))
      .child(div().flex_1().min_w(0).truncate().child(it.label))
      .when(Boolean(it.sub), (el) => el.child(div().flex_none().max_w(110).truncate().text_size(11).text_color(t.dim).child(it.sub)))
      .child(div().w(14).flex_none().flex().justify_center()
        .when(on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(13).text_color(t.accent))))
      .when(!p.query && i < 9, (el) => el.child(div().w(10).flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(i + 1))));
  };
  const note = (text, color) => h_flex().h(28).px(8).gap(8).items_center().text_color(color ?? t.dim).child(text);
  const list = p.error ? [note(p.error, t.ansi1)]
    : !p.items ? [h_flex().h(28).px(8).gap(8).items_center().text_color(t.dim)
      .child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.dim).spin(900)).child("loading…")]
    : !items.length ? [note("no matches")]
    : items.map(row);

  return v_flex().id(`picker-${p.field}`).w(300).mt(4).rounded(10).border_1().border_color(t.border).bg(t.popover).shadow_lg()
    .text_size(12.5).text_color(t.foreground).overflow_hidden()
    .on_mouse_down("left", stop).on_scroll_wheel(stop)
    .child(h_flex().h(36).px(12).gap(8).items_center().border_b(1).border_color(t.border)
      .child(svg("mods/workspace-chrome/search.svg").size(13).flex_none().text_color(t.dim))
      .child(h_flex().flex_1().min_w(0).items_center()
        .when(Boolean(p.query), (el) => el.child(div().truncate().child(p.query)))
        .child(div().w(1.5).h(15).flex_none().bg(t.accent).loop("opacity", { from: 0.15, to: 1, period: 1000 }))
        .when(!p.query, (el) => el.child(div().pl(2).truncate().text_color(t.dim).child(p.placeholder)))))
    .child(v_flex().id(`pick-list-${p.field}`).max_h(272).p(4).overflow_y_scroll().track_scroll(view.pickScroll).children(list))
    .child(h_flex().px(12).py(6).gap(12).border_t(1).border_color(t.border).text_size(10.5).text_color(t.dim)
      .child("↑↓ move").child(p.multi ? "↵ toggle" : "↵ select").child("esc close"));
}

// Wraps a field's trigger so its picker opens anchored under it.
export function anchored(view, t, field, trigger) {
  return Popup.new(`anchor-${field}`, trigger).anchor("top_left")
    .when(view.picker?.field === field, (el) => el.content(menu(view, t)));
}
