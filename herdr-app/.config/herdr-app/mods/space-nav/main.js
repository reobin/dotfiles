// alt-j/k walk the groups of the view the tree sidebar shows, and alt-]/[ the
// spaces inside the shown group: the active spaces, or the archived groups
// (the restore mod's records), and alt-. switches view. Landing on a group
// shows its first space, and alt-k from a later space returns to that first
// one. The archive is a view held over the shown space, so switching to it
// moves nothing. Draws nothing: the layout holds one copy in a 0px block, so
// the keys keep working while the sidebar is hidden.

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

// Keep in sync with tree's sets().
function sets(list) {
  const runs = [];
  for (const s of list) {
    const head = runs.at(-1)?.[0];
    if (head && s.named && head.named && s.name === head.name && (s.machine ?? null) === (head.machine ?? null)) runs.at(-1).push(s);
    else runs.push([s]);
  }
  return runs;
}

export default class SpaceNav extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next") this.step(1);
        if (c === "prev") this.step(-1);
        if (c === "next-in-group") this.stepIn(1);
        if (c === "prev-in-group") this.stepIn(-1);
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

  selectedRecord() {
    const list = records();
    return list.find((r) => r.id === shared(SELECTED)) ?? list[0] ?? null;
  }

  step(by) {
    if (this.inArchive()) {
      const list = records();
      if (!list.length) return;
      const r = this.selectedRecord();
      const i = list.findIndex((x) => x.id === r?.id);
      const at = /** @type {any} */ (shared(SPACE));
      if (by < 0 && r && at?.record === r.id && at.i > 0) return setShared(SPACE, { record: r.id, i: 0 });
      const next = list[(i + by + list.length) % list.length];
      setShared(SELECTED, next.id);
      return setShared(SPACE, { record: next.id, i: 0 });
    }
    const groups = sets(this.open());
    if (!groups.length) return;
    const i = groups.findIndex((g) => g.some((s) => s.active));
    if (by < 0 && i >= 0 && !groups[i][0].active) return run("space.select", { id: groups[i][0].id });
    const next = groups[i < 0 ? (by > 0 ? 0 : groups.length - 1) : (i + by + groups.length) % groups.length];
    run("space.select", { id: next[0].id });
  }

  stepIn(by) {
    if (this.inArchive()) {
      const r = this.selectedRecord();
      if (!r || r.spaces.length < 2) return;
      const at = /** @type {any} */ (shared(SPACE));
      const i = at?.record === r.id ? Math.min(at.i, r.spaces.length - 1) : 0;
      setShared(SELECTED, r.id);
      return setShared(SPACE, { record: r.id, i: (i + by + r.spaces.length) % r.spaces.length });
    }
    const group = sets(this.open()).find((g) => g.some((s) => s.active));
    if (!group || group.length < 2) return;
    const i = group.findIndex((s) => s.active);
    run("space.select", { id: group[(i + by + group.length) % group.length].id });
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
