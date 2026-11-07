// Smart split: one key splits where it makes most sense, right when the
// focused pane is wide, down when it is tall. Same geometry rule as the
// TUI's herdr-smart-split (terminal cells run about 2:1 tall:wide, so the
// width needs twice the rows to read side by side; a picked half that
// would be a sliver loses to the other axis). Draws nothing: the layout
// holds one copy in a 0px block, so only one copy ever listens.

import { View, div } from "gpui-kit";
import { focused, hc, notify, run, nextCommand, setShared } from "herdr";

export default class SmartSplit extends View {
  init(_props, cx) {
    setShared("smart-split.mounted", Date.now());
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        setShared("smart-split.last-command", { command, at: Date.now() });
        await this.split();
      }
    });
  }

  async split() {
    const f = focused();
    let direction = "right";
    let cols = null;
    let rows = null;
    try {
      if (f?.terminal) {
        const out = JSON.parse((await hc(["get", f.terminal, "--json"])).stdout || "{}");
        cols = Number(out.cols);
        rows = Number(out.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
          direction = cols >= rows * 2 ? "right" : "down";
          if (direction === "right" && cols / 2 < 20) direction = "down";
          if (direction === "down" && rows / 2 < 6) direction = "right";
        }
      }
    } catch (e) {
      notify({ title: "Smart split", body: `could not read terminal size: ${e?.message ?? e}`, level: "error" });
      return;
    }
    const args = { direction };
    if (f?.pane) args.pane = f.pane;
    setShared("smart-split.last-split", { direction, pane: f?.pane ?? null, cols, rows, at: Date.now() });
    run("pane.split", args);
  }

  render() {
    return div();
  }
}
