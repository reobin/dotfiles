// alt-j/k walk the section the shown space is in, the open spaces or the
// folded ones the tree sidebar sinks to the bottom, and alt-. hops to the
// other section. Draws nothing: the layout holds one copy in a 0px block,
// so the keys keep working while the sidebar is hidden.

import { View, div } from "gpui-kit";
import { spaces, run, shared, nextCommand } from "herdr";

const COLLAPSED = "tree.collapsed";

export default class SpaceNav extends View {
  init(_props, cx) {
    this.left = { top: null, dock: null }; // the space alt-. last left each section from
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next") this.step(1);
        if (c === "prev") this.step(-1);
        if (c === "switch") this.hop();
      }
    });
  }

  collapsed() {
    return new Set(/** @type {string[]} */ (shared(COLLAPSED) ?? []));
  }

  section(docked) {
    const folded = this.collapsed();
    return spaces().filter((s) => folded.has(s.id) === docked);
  }

  step(by) {
    const now = spaces().find((s) => s.active);
    if (!now) return;
    const list = this.section(this.collapsed().has(now.id));
    const i = list.findIndex((s) => s.id === now.id);
    run("space.select", { id: list[(i + by + list.length) % list.length].id });
  }

  hop() {
    const now = spaces().find((s) => s.active);
    if (!now) return;
    const docked = this.collapsed().has(now.id);
    const list = this.section(!docked);
    if (!list.length) return;
    this.left[docked ? "dock" : "top"] = now.id;
    const back = this.left[docked ? "top" : "dock"];
    run("space.select", { id: list.some((s) => s.id === back) ? back : list[0].id });
  }

  render() {
    return div();
  }
}
