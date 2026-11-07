// Toggle split: Hyprland's togglesplit for herdr. Turns the row or column
// holding the focused pane into the other axis, keeping its children's order
// and weights, its own size, and focus.
//
// Herdr has no orientation command, so it rebuilds the split: split the first
// child off the new axis with a placeholder pane, swap the next child into the
// placeholder, close it, and repeat, setting each child's size back with
// layout.resize as it lands. The tab's tree comes from herdr-core's saved document
// (docs.json), since mods can't read it any other way. Directional pane.swap
// works from the last drawn frame, so each placeholder must be drawn once
// before it can swap; pane.swap {target}, where herdr has it, skips that wait.
//
// The layout holds one listening copy in a 0px block; copies opened with
// { placeholder: true } are the stand-in panes.

import { View, div } from "gpui-kit";
import { commands, focused, home, nextCommand, notify, panes, props, readTextFile, run, spaces, theme } from "herdr";

const MOD = "toggle-split";
const DOCS = `${home()}/.local/state/herdr-core/default/docs.json`;
const SLIVER = 0.001;
const AXES = {
  row: { flip: "down", fwd: "right" },
  column: { flip: "right", fwd: "down" },
};

function pathTo(node, id) {
  if (node.id === id) return [node];
  for (const child of node.children ?? []) {
    const rest = pathTo(child, id);
    if (rest) return [node, ...rest];
  }
  return null;
}

function leaves(node) {
  return node.type === "block" ? [node.id] : (node.children ?? []).flatMap(leaves);
}

async function until(cx, check, ms = 500) {
  for (let waited = 0; waited <= ms; waited += 4) {
    const value = check();
    if (value) return value;
    await cx.sleep(4);
  }
  return null;
}

function fail(body) {
  notify({ title: "Toggle split", body, level: "warning" });
}

export default class ToggleSplit extends View {
  init(_props, cx) {
    this.placeholder = !!props()?.placeholder;
    if (this.placeholder) return;
    cx.spawn(async (cx) => {
      for (;;) {
        await nextCommand();
        try {
          await this.toggle(cx);
        } catch (e) {
          await cx.sleep(100);
          for (const p of panes().filter((p) => p.mod === MOD)) run("pane.close", { pane: p.pane });
          notify({ title: "Toggle split", body: String(e?.message ?? e), level: "error" });
        }
      }
    });
  }

  async toggle(cx) {
    const f = focused();
    if (!f?.pane) return;
    const mine = () => panes().filter((p) => p.tab === f.tab);
    if (mine().length < 2 || mine().some((p) => p.zoomed)) return;
    if (spaces().find((s) => s.id === f.space)?.machine) return fail("only this computer's spaces can flip");

    const root = await this.tree(cx, f.tab, mine);
    if (!root) return fail("couldn't read this tab's layout");
    if (focused()?.pane !== f.pane) return;

    const path = pathTo(root, f.pane);
    const parent = path?.[path.length - 2];
    if (!parent?.children || parent.children.length < 2 || !AXES[parent.type]) return;
    const kids = parent.children;
    if (kids.slice(1).some((k) => k.type !== "block")) {
      return fail("can't flip yet: the group after this pane would have to move");
    }

    await this.flip(cx, kids, AXES[parent.type], mine);
    run("pane.focus", { pane: f.pane });
    // The next toggle reads docs.json, so hold it until the flip is saved there.
    const order = kids.map((k) => k.id).join();
    await this.tree(cx, f.tab, mine, (r) => {
      const now = pathTo(r, f.pane)?.at(-2);
      return now?.type !== parent.type && now?.children?.map((c) => c.id).join() === order;
    });
  }

  // The tab's tree from herdr-core's document, once it matches the live panes
  // (and `ready`, if given).
  async tree(cx, tab, mine, ready = () => true) {
    for (let waited = 0; waited <= 500; waited += 25) {
      try {
        const doc = JSON.parse((await readTextFile(DOCS)) ?? "null");
        const root = doc?.["herdr-app"]?.value?.spaces?.flatMap((s) => s.tabs).find((t) => t.id === tab)?.root;
        if (root && leaves(root).join() === mine().map((p) => p.pane).join() && ready(root)) return root;
      } catch (_) {}
      await cx.sleep(25);
    }
    return null;
  }

  // panes() catches up with a command a moment after it runs, so each step
  // waits to see its result. While a child waits its turn it is shrunk to a
  // sliver, so the frames in between already look like the result, with an
  // empty slot where it lands.
  async flip(cx, kids, axis, mine) {
    const targeted = commands().find((c) => c.name === "pane.swap")?.args.some((a) => a.name === "target");
    const placeholder = () => mine().find((p) => p.mod === MOD)?.pane;
    const resize = (kid, id = kid.id) => {
      const px = kid.size?.px;
      run("layout.resize", px !== undefined ? { id, px } : { id, weight: kid.size?.weight ?? 1 });
    };
    try {
      for (let k = 1; k < kids.length; k++) {
        const before = new Set(mine().map((p) => p.pane));
        run("pane.split", { pane: kids[k - 1].id, direction: axis.flip, mod: MOD, props: { placeholder: true } });
        for (let j = k; j < kids.length; j++) run("layout.resize", { id: kids[j].id, weight: SLIVER });
        const stand = await until(cx, () => mine().find((p) => !before.has(p.pane))?.pane);
        if (!stand) throw new Error("the placeholder pane did not open");
        resize(kids[k - 1]);
        resize(kids[k], stand);
        await this.swap(cx, stand, kids[k].id, axis.fwd, targeted, mine);
        run("pane.close", { pane: stand });
        if (k < kids.length - 1 && !(await until(cx, () => !placeholder()))) {
          throw new Error("the placeholder pane did not close");
        }
      }
    } catch (e) {
      kids.forEach((kid) => resize(kid));
      throw e;
    }
  }

  // Pane ids move with their content, so the swap has landed once `target`
  // holds the placeholder's old place in pane order.
  async swap(cx, stand, target, direction, targeted, mine) {
    const slot = mine().findIndex((p) => p.pane === stand);
    const state = () => {
      const order = mine().map((p) => p.pane);
      if (order.indexOf(target) === slot) return "landed";
      return order.indexOf(stand) === slot ? null : "wrong";
    };
    const settle = async (ms) => {
      const result = await until(cx, state, ms);
      if (result === "wrong") throw new Error("the placeholder swapped with the wrong pane");
      return result;
    };
    if (targeted) {
      run("pane.swap", { pane: stand, target });
      if (await settle(500)) return;
      throw new Error("the swap didn't happen");
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      await cx.sleep(16);
      run("pane.focus", { pane: stand });
      run("pane.swap", { direction });
      if (await settle(250)) return;
    }
    throw new Error("the swap never happened");
  }

  render() {
    return this.placeholder ? div().size_full().bg(theme().background) : div();
  }
}
