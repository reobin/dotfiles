// Gives every pane's terminal a serial callsign (a1, a2, b1: a letter per space,
// a number per pane, counting up from the highest in use) as its `callsign`
// label, like the herdr-callsigns TUI plugin's serial scheme. Never overwrites
// one, so words `unified` gave stay. Unique per machine. Draws nothing: the
// layout holds one copy in a 0px block, so only one copy ever assigns.

import { View, div } from "gpui-kit";
import { panes, spaces, terminals, hc, shared, setShared } from "herdr";

const SERIAL = /^([a-z]+)([1-9][0-9]{0,15})$/;

// Given but not yet back in terminals(), so headers can show it at once.
const GIVEN = "callsigns.given";

const machineOf = (address) => (address.includes("/") ? address.split("/")[0] : "");
const local = (id) => id.split("/").pop();

function letter(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(97 + ((n - 1) % 26)) + s;
  return s;
}

export default class Callsigns extends View {
  init(_props, cx) {
    this.given = {};
    this.naming = false;
    // A 0px block is never re-rendered, so the timer is what notices new
    // panes. A tick is a few map lookups and runs hc only to name one.
    cx.timer.every(250, (cx) => this.assign(cx));
  }

  // A new pane shows in panes() before its terminal reaches terminals(), and
  // a label takes a moment to come back there too. So a pane's space comes
  // from the layout, what was given here counts as taken until it is back,
  // and the core is asked before labeling, so a lagging feed never overwrites.
  assign(cx) {
    if (this.naming) return;
    const terms = new Map(terminals().map((x) => [x.address, x]));
    const spaceOfTab = new Map(spaces().flatMap((s) => s.tabs.map((t) => [t.id, local(s.id)])));
    const paneSpace = new Map(panes().filter((p) => p.terminal).map((p) => [p.terminal, spaceOfTab.get(p.tab) ?? ""]));
    for (const [address, sign] of Object.entries(this.given)) {
      if (!paneSpace.has(address) || terms.get(address)?.labels?.callsign === sign) delete this.given[address];
    }
    const todo = [...paneSpace.keys()].filter((a) => {
      const x = terms.get(a);
      return !this.given[a] && !x?.labels?.callsign && (!x || x.state === "live");
    });
    for (const address of todo) this.given[address] = this.pick(address, paneSpace, [...terms.values()]);
    this.publish();
    if (!todo.length) return;
    this.naming = true;
    cx.spawn(async () => {
      for (const address of todo) {
        try {
          const now = JSON.parse((await hc(["get", address, "--json"])).stdout || "{}").labels?.callsign;
          if (now) this.given[address] = now;
          else if ((await hc(["label", address, `callsign=${this.given[address]}`])).code !== 0) delete this.given[address];
        } catch {
          delete this.given[address];
        }
      }
      this.naming = false;
      this.publish();
    });
  }

  publish() {
    if (JSON.stringify(shared(GIVEN) ?? {}) !== JSON.stringify(this.given)) setShared(GIVEN, { ...this.given });
  }

  pick(address, paneSpace, all) {
    const machine = machineOf(address);
    const space = (a) => paneSpace.get(a) ?? all.find((x) => x.address === a)?.labels?.["herdr.space"] ?? "";
    const signs = new Map(all.map((x) => [x.address, x.labels?.callsign]));
    for (const [a, sign] of Object.entries(this.given)) if (!signs.get(a)) signs.set(a, sign);
    const serials = [...signs]
      .filter(([a]) => machineOf(a) === machine)
      .map(([a, sign]) => [a, SERIAL.exec(sign ?? "")])
      .filter(([, m]) => m);
    const taken = new Set(serials.filter(([a]) => space(a) !== space(address)).map(([, m]) => m[1]));
    let l = serials.filter(([a]) => space(a) === space(address)).map(([, m]) => m[1]).sort()[0];
    for (let i = 0; !l; i++) if (!taken.has(letter(i))) l = letter(i);
    const max = Math.max(0, ...serials.filter(([, m]) => m[1] === l).map(([, m]) => Number(m[2])));
    return `${l}${max + 1}`;
  }

  render() {
    return div();
  }
}
