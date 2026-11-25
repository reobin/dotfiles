import { div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextareaState, Textarea, TextView } from "gpui-base";
import { run, focused, panes, terminals, spaces, layout, shared } from "herdr";
import { ICONS, SANS, MONO, ago, open } from "./look.js";
import { pickerKey, avatar } from "./picker.js";

// pane.go gives a panel the keyboard; global keys still scroll it from a terminal.
const STEP = 160, LINE = 40;
// What a change shows until a refresh has had time to bring the real value.
const HOLD_MS = 20000;
const SPINNER = "mods/workspace-chrome/spinner.svg";

export function initPanel(view, name, cx) {
  view.panelName = name;
  view.offset = 0;
  view.handle = cx.focus_handle();
  view.pickScroll = ScrollHandle.new();
  view.picker = null;
  view.confirm = null;
  view.notice = null;
  view.over = {};
  view.keymap = [];
  view.composing = false;
  view.sending = false;
  view.commentH = {};
  view.expanded = new Set();
  view.input = TextareaState.new({ placeholder: "leave a comment…", rows: 2 });
  view.input.set_auto_grow(2, 10);
  view.input.on("change", (_e, cx) => cx.notify());
}

const maxOffset = (view) => Math.max(0, (view.contentH ?? 0) - (view.viewH ?? 0));

function scrollTo(view, offset, cx) {
  const next = Math.min(maxOffset(view), Math.max(0, offset));
  if (next !== view.offset) { view.offset = next; cx.notify(); }
}

export const hasKeyboard = (view) => view.composing || view.handle.is_focused();

const CHILD = { ticket: "ticket-status", pr: "pr-status", repo: "repo-status" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const found = find(child, id); if (found) return found; }
  return null;
}

export function isShown(name) {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body?.active === CHILD[name]);
}

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
  if (view.composing) view.input.focus(); else view.handle.focus();
}

function activeTab() {
  return spaces().find((s) => s.active)?.tabs.find((t) => t.active)?.id ?? null;
}

export function closePanel(view) {
  const back = view.returnTo, tab = activeTab();
  view.returnTo = null; view.picker = null; view.confirm = null;
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
  else if (command === "escape") escape(view, cx);
  else if (command === "submit") { if (view.composing) submitComposer(view, cx); }
  cx.notify();
}

// Esc arrives as a key and, from inside the text box, as the mod's key binding: one press, one step back.
function escape(view, cx) {
  const now = Date.now();
  if (now - (view.escAt ?? 0) < 150) return;
  view.escAt = now;
  if (view.confirm) view.confirm = null;
  else if (view.picker) view.picker = null;
  else if (view.composing) cancelComposer(view);
  else return closePanel(view);
  cx.notify();
}

export function say(view, cx, text, level = "ok") {
  const id = (view.noticeId ?? 0) + 1;
  view.noticeId = id;
  view.notice = { id, text, level };
  cx.timer.after(level === "error" ? 7000 : 2500, (cx) => { if (view.notice?.id === id) { view.notice = null; cx.notify(); } });
  cx.notify();
}

const errorText = (e) => String(e?.message ?? e).replace(/^Error:\s*/, "");

// Shows `value` for `scope:field` at once, runs the change after any earlier one, then
// keeps showing it until a refresh has had time to land. A failure puts the old value back.
export function act(view, cx, { scope, field, value, task, ok }) {
  const key = field ? `${scope}:${field}` : null;
  const mine = key ? { value, pending: true, until: 0 } : null;
  if (key) view.over[key] = mine;
  const before = view.chain ?? Promise.resolve();
  let done;
  view.chain = new Promise((resolve) => { done = resolve; });
  cx.spawn(async (cx) => {
    await before;
    try {
      await task();
      if (mine) { mine.pending = false; mine.until = Date.now() + HOLD_MS; }
      if (ok) say(view, cx, ok);
      cx.timer.after(1200, () => run("status-tabs.refresh"));
    } catch (e) {
      if (key && view.over[key] === mine) delete view.over[key];
      say(view, cx, errorText(e), "error");
    } finally {
      done();
      cx.notify();
    }
  });
  cx.notify();
}

export function valueOf(view, scope, field, real) {
  const o = view.over[`${scope}:${field}`];
  return o && (o.pending || Date.now() < o.until) ? o.value : real;
}

export const isPending = (view, scope, field) => Boolean(view.over[`${scope}:${field}`]?.pending);

export function ask(view, cx, confirm) {
  focusPanel(view);
  view.picker = null;
  view.confirm = confirm;
  cx.notify();
}

export function openComposer(view, cx) {
  focusPanel(view);
  view.picker = null; view.confirm = null;
  view.composing = true;
  view.offset = Number.MAX_SAFE_INTEGER;
  view.input.focus();
  cx.notify();
}

function cancelComposer(view) {
  view.composing = false;
  view.handle.focus();
}

function submitComposer(view, cx) {
  const body = view.input.value().trim(), send = view.composerSend;
  if (!body || view.sending || !send) return;
  view.sending = true;
  cx.spawn(async (cx) => {
    try {
      await send(body);
      view.input.set_value("");
      view.composing = false;
      view.handle.focus();
      say(view, cx, "comment posted");
      cx.timer.after(1200, () => run("status-tabs.refresh"));
    } catch (e) { say(view, cx, errorText(e), "error"); }
    finally { view.sending = false; cx.notify(); }
  });
  cx.notify();
}

function panelKey(view, e, cx) {
  if (view.composing) {
    // A posted comment can't be taken back from here, so Enter is a new line and only ⌘↵ sends.
    if (e.key === "escape") { cx.stop_propagation(); escape(view, cx); }
    else if (e.keystroke === "cmd-enter") { cx.stop_propagation(); submitComposer(view, cx); }
    return;
  }
  if (view.picker) return pickerKey(view, e, cx);
  if (view.confirm) {
    if (e.key === "enter") { const c = view.confirm; view.confirm = null; c.run(cx); }
    else if (e.key === "escape" || e.key === "n" || e.key === "q") escape(view, cx);
    cx.stop_propagation(); cx.notify();
    return;
  }
  const m = e.modifiers;
  if (m.platform || m.control || m.alt) return;
  const k = m.shift && /^[a-z]$/.test(e.key) ? e.key.toUpperCase() : e.key;
  if (k === "j" || k === "down") scrollTo(view, view.offset + LINE, cx);
  else if (k === "k" || k === "up") scrollTo(view, view.offset - LINE, cx);
  else if (k === "space") scrollTo(view, view.offset + (m.shift ? -1 : 1) * (view.viewH ?? STEP), cx);
  else if (k === "g" || k === "G") scrollTo(view, k === "G" ? maxOffset(view) : 0, cx);
  else if (k === "escape" || k === "q") escape(view, cx);
  else if (k === "u") view.refresh(cx);
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
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(busy ? "refreshing…" : "refresh (u)")
    .on_click((_e, cx) => view.refresh(cx)).child(busy ? spinner(t) : icon("refresh"));
}

const stop = (_e, cx) => cx.stop_propagation();

function footer(view, t) {
  const c = view.confirm, n = view.notice;
  const chip = (id, label, key, primary, onClick) => h_flex().id(id).h(22).px(8).gap(6).items_center().rounded(6).cursor_pointer()
    .text_size(11.5).font_semibold().on_mouse_down("left", stop).on_click(onClick)
    .when(primary, (el) => el.bg(t.solid).text_color(t.solid_foreground).hover((s) => s.opacity(0.9)))
    .when(!primary, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)))
    .child(label).child(div().opacity(0.7).font_family(MONO).text_size(10.5).child(key));
  if (c) {
    return v_flex().flex_none().mx(8).mb(8).p(10).gap(8).rounded(9).border_1().border_color(t.accent + "33").bg(t.accent + "14")
      .child(h_flex().gap(8).items_center().child(icon(c.icon ?? "merge-ready", t.accent, 14)).child(div().flex_1().min_w(0).text_size(12.5).child(c.text)))
      .child(h_flex().gap(6).justify_end()
        .child(chip("confirm-no", "cancel", "esc", false, (_e, cx) => { view.confirm = null; view.handle.focus(); cx.notify(); }))
        .child(chip("confirm-yes", c.verb, "↵", true, (_e, cx) => { view.confirm = null; c.run(cx); cx.notify(); })));
  }
  if (n) {
    const color = n.level === "error" ? t.ansi1 : t.ansi2;
    return h_flex().flex_none().mx(8).mb(8).px(10).py(7).gap(8).items_center().rounded(8).bg(color + "1a").text_size(12)
      .child(icon(n.level === "error" ? "changes" : "approved", color, 13)).child(div().flex_1().min_w(0).text_color(t.foreground).child(n.text));
  }
  if (view.composing) return null;
  const hints = view.keymap.filter((a) => a.hint);
  return h_flex().flex_none().px(14).py(8).gap(14).flex_wrap().text_size(11).text_color(t.dim)
    .children([...hints, { key: "esc", label: "close" }].map((a) => h_flex().gap(4).items_center().child(kbd(t, a.key)).child(a.label)));
}

export function panelShell(view, t, { header, body }) {
  const max = maxOffset(view);
  view.offset = Math.min(view.offset, max);
  const name = view.panelName;
  const bottom = footer(view, t);

  return v_flex().id(`${name}-panel`).size_full().min_h(0).rounded(12).overflow_hidden().bg(t.background)
    .border_1().border_color(t.background).font_family(SANS).text_color(t.foreground).text_size(13)
    .track_focus(view.handle).focus((s) => s.border_color(t.accent)).on_key_down((e, cx) => panelKey(view, e, cx))
    .on_mouse_down("left", (_e, cx) => {
      if (view.picker) { view.picker = null; cx.notify(); }
      if (!view.composing) focusPanel(view);
    })
    .child(header)
    .child(div().id(`${name}-view`).flex_1().min_h(0).relative().overflow_hidden()
      .on_size_change((s, cx) => { if (s.height !== view.viewH) { view.viewH = s.height; cx.notify(); } })
      .on_scroll_wheel((e, cx) => scrollTo(view, view.offset - e.delta.y, cx))
      .child(div().id(`${name}-content`).absolute().left(0).right(0).top(-view.offset)
        .on_size_change((s, cx) => { if (s.height !== view.contentH) { view.contentH = s.height; cx.notify(); } })
        .child(body))
      .when(max > 0, (e) => e.child(div().absolute().right(2).w(3).rounded(2).bg(t.border)
        .top((view.offset / view.contentH) * view.viewH).h((view.viewH / view.contentH) * view.viewH))))
    .when(Boolean(bottom), (e) => e.child(bottom));
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

// The comment box at the end of a panel: a quiet row until opened, then a growing text box.
export function composer(view, t, { label, send }) {
  view.composerSend = send;
  if (!view.composing) {
    return h_flex().id("composer-open").mx(14).mb(14).h(34).px(10).gap(8).items_center().rounded(8).cursor_pointer()
      .border_1().border_color(t.border).text_color(t.dim).hover((s) => s.border_color(t.input).text_color(t.muted))
      .on_mouse_down("left", stop).on_click((_e, cx) => openComposer(view, cx))
      .child(icon("comment", null, 13)).child(div().flex_1().child(label))
      .child(kbd(t, "c"));
  }
  const filled = Boolean(view.input.value().trim());
  return v_flex().id("composer").mx(14).mb(14).rounded(8).border_1().border_color(t.accent).bg(t.background)
    .on_mouse_down("left", stop)
    .child(div().px(10).pt(8).pb(4).child(Textarea.new(view.input).w_full().text_size(12.5).text_color(t.foreground)))
    .child(h_flex().px(6).pb(6).gap(6).items_center()
      .child(div().flex_1())
      .child(h_flex().id("composer-cancel").h(24).px(8).gap(5).items_center().rounded(6).cursor_pointer().text_size(11.5).text_color(t.muted)
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { cancelComposer(view); cx.notify(); })
        .child("cancel").child(div().opacity(0.6).font_family(MONO).text_size(10.5).child("esc")))
      .child(h_flex().id("composer-send").h(24).px(10).gap(6).items_center().rounded(6).text_size(11.5).font_semibold()
        .bg(filled ? t.solid : t.raised).text_color(filled ? t.solid_foreground : t.dim)
        .when(filled && !view.sending, (el) => el.cursor_pointer().hover((s) => s.opacity(0.9)).on_click((_e, cx) => submitComposer(view, cx)))
        .when(view.sending, (el) => el.child(spinner(t, 11)))
        .child("comment").child(div().opacity(0.6).font_family(MONO).text_size(10.5).child("⌘↵"))));
}
