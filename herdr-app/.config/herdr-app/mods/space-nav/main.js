// alt-j/k walk the section the shown space is in, the open spaces or the
// archived ones the tree sidebar sinks to the bottom, and alt-. hops to the
// other section. Draws nothing: the layout holds one copy in a 0px block,
// so the keys keep working while the sidebar is hidden.

import { View, div } from "gpui-kit";
import { spaces, run, shared, nextCommand } from "herdr";

const ARCHIVED = "tree.archived";
// Read until the first archive toggle writes ARCHIVED; tree reads it the same way.
const LEGACY = "tree.collapsed";

export default class SpaceNav extends View {
  init(_props, cx) {
    this.left = { open: null, archive: null }; // the space alt-. last left each section from
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next") this.step(1);
        if (c === "prev") this.step(-1);
        if (c === "switch") this.hop();
      }
    });
  }

  archived() {
    return new Set(/** @type {string[]} */ (shared(ARCHIVED) ?? shared(LEGACY) ?? []));
  }

  section(inArchive) {
    const archived = this.archived();
    return spaces().filter((s) => archived.has(s.id) === inArchive);
  }

  step(by) {
    const now = spaces().find((s) => s.active);
    if (!now) return;
    const list = this.section(this.archived().has(now.id));
    const i = list.findIndex((s) => s.id === now.id);
    run("space.select", { id: list[(i + by + list.length) % list.length].id });
  }

  hop() {
    const now = spaces().find((s) => s.active);
    if (!now) return;
    const inArchive = this.archived().has(now.id);
    const list = this.section(!inArchive);
    if (!list.length) return;
    this.left[inArchive ? "archive" : "open"] = now.id;
    const back = this.left[inArchive ? "open" : "archive"];
    run("space.select", { id: list.some((s) => s.id === back) ? back : list[0].id });
  }

  render() {
    return div();
  }
}
