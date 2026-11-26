import { div } from "gpui-kit";

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
