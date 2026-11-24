// alt-j/k walk the section the tree sidebar shows, the open spaces or the
// archived ones, and alt-. hops to the other section, onto its empty view when
// it has no spaces. Draws nothing: the layout holds one copy in a 0px block,
// so the keys keep working while the sidebar is hidden.

import { View, div } from "gpui-kit";
import { spaces, run, shared, setShared, nextCommand } from "herdr";

const ARCHIVED = "tree.archived";
// Read until the first archive toggle writes ARCHIVED; tree reads it the same way.
const LEGACY = "tree.collapsed";
// { view: "open" | "archive", at }: the view held while the space at is shown; tree writes it too.
const VIEW = "tree.view";

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

  // Keep in sync with tree's viewOf().
  inArchive() {
    const now = spaces().find((s) => s.active)?.id ?? null;
    const pin = /** @type {{ view: string, at: string | null } | undefined} */ (shared(VIEW));
    if (pin && pin.at === now) return pin.view === "archive";
    return Boolean(now) && this.archived().has(now);
  }

  step(by) {
    const list = this.section(this.inArchive());
    if (!list.length) return;
    const i = list.findIndex((s) => s.active);
    const next = i < 0 ? (by > 0 ? 0 : list.length - 1) : (i + by + list.length) % list.length;
    run("space.select", { id: list[next].id });
  }

  hop() {
    const now = spaces().find((s) => s.active)?.id ?? null;
    const inArchive = this.inArchive();
    if (this.section(inArchive).some((s) => s.id === now)) this.left[inArchive ? "archive" : "open"] = now;
    const list = this.section(!inArchive);
    const back = this.left[inArchive ? "open" : "archive"];
    const target = list.find((s) => s.id === back) ?? list[0];
    if (!target) return setShared(VIEW, { view: inArchive ? "open" : "archive", at: now });
    setShared(VIEW, null);
    run("space.select", { id: target.id });
  }

  render() {
    return div();
  }
}
