// Closes every pane in the focused tab except the focused one. Draws nothing:
// the layout holds one copy in a 0px block, so only one copy ever listens.

import { View, div } from "gpui-kit";
import { focused, nextCommand, panes, run } from "herdr";

export default class CloseOthers extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        await nextCommand();
        this.closeOthers();
      }
    });
  }

  closeOthers() {
    const f = focused();
    if (!f?.pane) return;
    for (const p of panes()) {
      if (p.tab === f.tab && p.pane !== f.pane) run("pane.close", { pane: p.pane });
    }
  }

  render() {
    return div();
  }
}
