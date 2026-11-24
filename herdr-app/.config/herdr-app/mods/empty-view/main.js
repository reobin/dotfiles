// Stands in for the panes while the tree sidebar holds an empty view: the tree
// switches the main-stack to this block and names the view in tree.empty. It
// takes the keyboard when it shows, so typing can't reach the hidden space's
// terminals; the tree hands focus back to a pane when it goes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, shared, checking } from "herdr";

const MONO = "JetBrains Mono";
const EMPTY = "tree.empty";

export default class EmptyView extends View {
  init(_props, cx) {
    this.focus = cx.focus_handle();
    this.took = false;
    if (checking()) return;
    cx.timer.every(200, () => {
      const shown = Boolean(shared(EMPTY));
      if (shown && !this.took) this.focus.focus();
      this.took = shown;
    });
  }

  render() {
    const t = theme();
    const inArchive = shared(EMPTY) === "archive";
    const ink = inArchive ? t.ansi5 : t.dim;
    const [glyph, what, key, act] = inArchive
      ? ["archive", "active spaces", "alt-.", () => run("space-nav.switch")]
      : ["cube", "new space", "cmd-n", () => run("mod.open", { name: "new-space" })];
    return v_flex().id("empty-view").track_focus(this.focus).size_full().rounded(12).bg(t.background).justify_center().items_center().gap(14)
      .child(svg(`mods/tree/${glyph}.svg`).size(28).text_color(ink))
      .child(h_flex().id("empty-view-act").h(28).px(12).gap(10).items_center().rounded(7)
        .font_family(MONO).text_size(12).text_color(t.muted)
        .bg(t.foreground + "0a").hover((x) => x.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_mouse_up("left", (_e, cx) => {
          cx.stop_propagation();
          act();
        })
        .child(div().child(what))
        .child(div().opacity(0.6).text_size(11).child(key)));
  }
}
