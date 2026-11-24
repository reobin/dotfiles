import { div } from "gpui-kit";

// Every status is the same 2×2 square of dots, so they line up and read as
// one family. Done holds it, blocked breathes it. Working glides a glow
// round the square. Each dot stacks one lit layer per brightness, as wide as
// its frame text, and frames share one clock, so every dot stays in step.
const ORDER = [0, 1, 3, 2];
const STEPS = 12;
const LEVELS = [1, 0.7, 0.45, 0.25];

function glow(dot, f) {
  const behind = ((f * 4) / STEPS - dot + 4) % 4;
  return behind > 3.5 ? (behind - 3.5) * 1.2 : Math.max(0, 1 - behind / 2.4);
}

function level(dot, f) {
  const b = glow(dot, f);
  if (b < 0.15) return -1;
  return LEVELS.reduce((best, l, i) => (Math.abs(l - b) < Math.abs(LEVELS[best] - b) ? i : best), 0);
}

function square(size, dot) {
  const d = Math.round(size * 0.3 * 2) / 2;
  const g = Math.round(size * 0.13 * 2) / 2;
  return div().size(size).flex_none().flex().items_center().justify_center()
    .child(div().w(d * 2 + g).flex().flex_wrap().gap(g)
      .children([0, 1, 2, 3].map((i) => dot(div().size(d).flex_none().rounded(d / 2), i, d))));
}

function lit(color, d, dot, i) {
  const frames = Array.from({ length: STEPS }, (_, f) => (level(dot, f) === i ? "x" : ""));
  return div().h(d).rounded(d / 2).bg(color).opacity(LEVELS[i]).overflow_hidden()
    .font_family("JetBrains Mono").text_size(d / 0.6).line_height(d).text_color(color).frames(frames, 60);
}

export function mark(t, status, size = 12) {
  if (status === "working") return square(size, (el, i, d) => el.bg(t.working + "2e").flex().justify_center()
    .children(LEVELS.map((_, l) => lit(t.working, d, ORDER[i], l))));
  if (status === "done") return square(size, (el) => el.bg(t.done));
  if (status === "blocked") return square(size, (el) => el.bg(t.blocked)).loop("opacity", { from: 0.3, to: 1, period: 1400 });
  return null;
}
