// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane-header" } } } }
// Shows the terminal's address, the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, how many lines it's scrolled back (click: to the bottom), a zoom mark while zoomed, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane. While link-hints runs on this pane,
// its labels are drawn here (hints.js).

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { mark } from "./marks.js";
import { withHints } from "./hints.js";
import { panes, props, run, theme, home, shared, spaces } from "herdr";

const SANS = "Geist";
const MONO = "JetBrains Mono";
// image() rasterizes these 1em SVGs small and scales them up into a blurry fringe;
// they are one color, so svg() can draw them crisp in that color.
const BRAND = { "icons/claude.svg": "#D97757", "icons/amp.svg": "#F34E3F", "icons/kiro.svg": "#9046FF", "icons/codex.svg": "#7A9DFF" };
// The app's codex icon is its mark on a white tile; draw the mark alone.
const GLYPH = { "icons/codex.svg": "mods/tree/codex.svg" };

function icon(p, size, color) {
  if (!p?.icon) return null;
  const tint = p.tint ? color : BRAND[p.icon];
  return tint ? svg(GLYPH[p.icon] ?? p.icon).size(size).flex_none().text_color(tint) : image(p.icon).w(size).h(size).flex_none();
}

// What to type for a terminal: its address's last two characters, more while another pane's address ends the same way.
function shorthand(address) {
  const local = (a) => a.split("/").pop();
  const me = local(address);
  const others = panes().map((p) => p.terminal).filter((a) => a && a !== address).map(local);
  let n = 2;
  while (n < me.length - 1 && others.some((o) => o.endsWith(me.slice(-n)))) n++;
  return [address.slice(0, -n), address.slice(-n)];
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init(_props, cx) {
    this.hovered = false;
    // panes() reads scroll fresh but only re-renders on end/history transitions, so the count needs its own tick.
    this.back = 0;
    cx.timer.every(300, (cx) => {
      const back = this.me()?.scroll?.from_bottom ?? 0;
      if (back !== this.back) { this.back = back; cx.notify(); }
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(4)
      .rounded(5)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane-header/${icon}.svg`).size(14));
  }

  render(cx) {
    // While the tree shows an archived space, its colour (the theme's ansi5) stands in for the accent, as in the sidebar.
    const base = theme();
    const space = spaces().find((s) => s.active);
    const archived = Boolean(space) && (shared("tree.archived") ?? []).includes(space.id);
    const t = archived ? { ...base, accent: base.ansi5 } : base;
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const sign = p.terminal;
    const [head, tail] = sign ? shorthand(sign) : ["", ""];
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const back = p.scroll?.from_bottom ?? 0;
    const header = h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      // A wash of the accent, so the header turns violet with the rest in the archive. The
      // pane's border belongs to the layout; the header is the part of the frame a mod can mark.
      .bg(t.accent + "14").rounded_t(11)
      .px(8)
      .gap(8)
      .items_center()
      .font_family(SANS)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(sign), (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.accent + "26").font_family(MONO).text_size(11).font_semibold().text_color(t.accent).child(div().opacity(0.5).child(head)).child(tail)))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().font_family(MONO).text_color(t.dim).child(folder(p.cwd)))
      .when(back > 0 && Boolean(p.terminal), (el) => el.child(div().id(`ph-back-${pane}`).flex_none().px(8).h(18).flex().items_center().rounded(5)
        .bg(t.foreground + "0f").font_family(MONO).text_size(11).text_color(t.dim).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); run("terminal.scroll", { terminal: p.terminal, to: "bottom" }); })
        .child(`↓ ${back}`)))
      .when(p.zoomed, (el) => el.child(div().flex_none().px(4).h(18).flex().items_center().rounded(5).bg(t.accent + "26").text_color(t.accent)
        .child(svg("mods/pane-header/zoomed.svg").size(12))))
      .when(st === "working" || st === "done", el => el.child(mark(t, st)))
      .when(st === "blocked", el => el.child(div().flex_none().px(8).h(18).flex().gap(4).items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child(mark(t, "blocked", 10)).child("needs you")))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
    return withHints(header, pane);
  }
}
