// Link hints for the pane under this header, while the link-hints mod shares them. A popup pins
// its content to the header's bottom-left, which is where the pane's terminal starts, so the
// labels land on the URLs in any split. Only the corner is laid out (1×1): a popup bigger than
// the room left in the window is moved, and moved labels would point at the wrong text.

import { div } from "gpui-kit";
import { h_flex, Popup } from "gpui-base";
import { settings, shared, theme } from "herdr";

export const HINTS = "link-hints.shown";
// Shared values outlive the app; a session left behind by a crash shouldn't come back.
const STALE_MS = 10 * 60 * 1000;
// Mods can't read the display scale; a Retina display is assumed.
const SCALE = 2;

// Ghostty rounds cells to whole device pixels at the zoomed font size; JetBrains Mono's advance
// is 0.6em and its ascent plus descent 1.32em. Mod sizes are scaled by zoom, so it comes back out.
function cell(s) {
  const zoom = Number(s.zoom ?? 1);
  const px = Number(s.font_size ?? 14) * zoom * SCALE;
  return {
    w: Math.round(px * 0.6) * Number(s.terminal_cell_width ?? 1) / SCALE / zoom,
    h: Math.round(px * 1.32) * Number(s.terminal_line_height ?? 1) / SCALE / zoom,
  };
}

function layer({ grid, hints, typed, copying }) {
  const s = settings();
  const c = cell(s);
  const pad = s.terminal_padding ?? 0;
  const [padY, padX] = Array.isArray(pad) ? pad.map(Number) : [Number(pad), Number(pad)];
  const x = (col) => padX + col * c.w;
  const y = (row) => padY + row * c.h;
  const t = theme();
  const font = String(s.font ?? "JetBrains Mono");
  const shown = hints.filter((h) => h.label.startsWith(typed));

  // Labels take the terminal palette's blue (green while ⇧ copies), with the
  // terminal background as ink, so they follow light and dark themes.
  const solid = (copying ? t.ansi2 : t.ansi4) ?? t.accent;
  const ink = t.background;
  const alpha = (color, a) => (/^#[0-9a-f]{6}$/i.test(color) ? color + a : color);
  const letters = (h) => [
    typed && div().text_color(alpha(ink, "80")).child(typed.toUpperCase()),
    div().child(h.label.slice(typed.length).toUpperCase()),
  ].filter(Boolean);

  // Everything but the links fades back: a veil of the terminal's own
  // background over every cell that isn't part of a shown URL.
  const veil = shown.length ? Array.from({ length: grid.rows }, (_, r) => {
    const spans = shown.flatMap((h) => h.spans.filter((sp) => sp.row === r)).sort((a, b) => a.start - b.start);
    const gaps = [];
    let at = 0;
    for (const sp of [...spans, { start: grid.cols, end: grid.cols }]) {
      if (sp.start > at) gaps.push([at, sp.start]);
      at = Math.max(at, sp.end);
    }
    return gaps.map(([from, to]) => div().id(`veil-${r}-${from}`).absolute()
      .left(x(from)).top(y(r)).w((to - from) * c.w).h(c.h).bg(alpha(t.background, "a8")));
  }).flat() : [];

  // The label ends just left of the URL, over the dimmed text before it,
  // so the whole address stays readable.
  const marker = (h) => {
    const first = h.spans[0];
    return h_flex()
      .id(`hint-${h.label}`)
      .absolute()
      .right(1 - x(first.start) + 2)
      .top(y(first.row) + 1)
      .min_w(Math.max(h.label.length, 1.6) * c.w)
      .h(c.h - 2)
      .px(3)
      .items_center()
      .justify_center()
      .rounded(5)
      .bg(solid)
      .shadow_sm()
      .text_color(ink)
      .font_family(font)
      .font_weight(800)
      .text_size(Math.max(10, Math.round(c.h * 0.64)))
      .whitespace_nowrap()
      .children(letters(h));
  };

  return div().id("link-hints-layer").w(1).h(1).children(veil).children(shown.map(marker));
}

export function withHints(header, pane) {
  const state = shared(HINTS);
  const popup = Popup.new(`link-hints-${pane}`, header).size_full().anchor("top_left");
  const live = state && state.pane === pane && Date.now() - Number(state.at) < STALE_MS;
  return live ? popup.content(layer(state)) : popup;
}
