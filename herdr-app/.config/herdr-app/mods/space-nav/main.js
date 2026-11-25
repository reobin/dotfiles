// alt-j/k walk the view the tree sidebar shows: the active spaces, or the
// archived groups' spaces (the restore mod's records), and alt-. switches view. The
// archive is a view held over the shown space, so switching to it moves
// nothing. Draws nothing: the layout holds one copy in a 0px block, so the
// keys keep working while the sidebar is hidden.

import { View, div } from "gpui-kit";
import { spaces, run, shared, setShared, nextCommand } from "herdr";

const ARCHIVED = "tree.archived";
// Read until the first archive toggle writes ARCHIVED; tree reads it the same way.
const LEGACY = "tree.collapsed";
// { view: "open" | "archive", at }: the view held while the space at is shown; tree writes it too.
const VIEW = "tree.view";
// Read as tree reads them.
const RECORDS = "restore.records";
const QUEUE = "restore.queue";
const SELECTED = "archive.selected";
const SPACE = "archive.space";
const records = () => /** @type {any[]} */ (shared(RECORDS) ?? []);

export default class SpaceNav extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next") this.step(1);
        if (c === "prev") this.step(-1);
        if (c === "switch") this.hop();
      }
    });
  }

  // Keep in sync with tree's archived().
  archived() {
    const ids = new Set(/** @type {string[]} */ (shared(ARCHIVED) ?? shared(LEGACY) ?? []));
    for (const r of records()) for (const s of r.spaces) ids.add(s.done ?? s.id);
    for (const op of /** @type {any[]} */ (shared(QUEUE) ?? [])) for (const id of op.ids ?? []) ids.add(id);
    return ids;
  }

  open() {
    const archived = this.archived();
    return spaces().filter((s) => !archived.has(s.id));
  }

  // Keep in sync with tree's viewOf().
  inArchive() {
    const now = spaces().find((s) => s.active)?.id ?? null;
    const pin = /** @type {{ view: string, at: string | null } | undefined} */ (shared(VIEW));
    if (pin && pin.at === now) return pin.view === "archive";
    return Boolean(now) && this.archived().has(now);
  }

  step(by) {
    // The archive walks its spaces card by card, through every group, as the active view does.
    if (this.inArchive()) {
      const list = records().flatMap((r) => r.spaces.map((_, i) => ({ record: r.id, i })));
      if (!list.length) return;
      const id = records().find((r) => r.id === shared(SELECTED))?.id ?? list[0].record;
      const at = /** @type {any} */ (shared(SPACE));
      const i = list.findIndex((x) => x.record === id && x.i === (at?.record === id ? at.i : 0));
      const next = list[i < 0 ? 0 : (i + by + list.length) % list.length];
      setShared(SELECTED, next.record);
      return setShared(SPACE, next);
    }
    const list = this.open();
    if (!list.length) return;
    const i = list.findIndex((s) => s.active);
    const next = i < 0 ? (by > 0 ? 0 : list.length - 1) : (i + by + list.length) % list.length;
    run("space.select", { id: list[next].id });
  }

  // Back from the archive onto the shown space, or the first active one when
  // the shown space is itself out of the active view.
  hop() {
    const now = spaces().find((s) => s.active)?.id ?? null;
    if (!this.inArchive()) return setShared(VIEW, { view: "archive", at: now });
    const open = this.open();
    if (open.some((s) => s.id === now)) return setShared(VIEW, null);
    if (!open.length) return setShared(VIEW, { view: "open", at: now });
    setShared(VIEW, null);
    run("space.select", { id: open[0].id });
  }

  render() {
    return div();
  }
}
