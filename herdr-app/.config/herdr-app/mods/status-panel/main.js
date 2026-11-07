import { View, div } from "gpui-kit";
import { nextCommand, props } from "herdr";
import { initPanel, panelCommand } from "./panel.js";
import { renderPr } from "./pr.js";
import { renderTicket } from "./ticket.js";

const PANELS = { pr: renderPr, ticket: renderTicket };

export default class StatusPanel extends View {
  init(_props, cx) {
    this.panel = PANELS[props()?.panel] ?? null;
    initPanel(this, props()?.panel, cx);
    cx.spawn(async (cx) => { for (;;) panelCommand(this, await nextCommand(), cx); });
  }

  render() {
    return this.panel ? this.panel(this) : div();
  }
}
