// nvim input: write what you'd type into the focused terminal in nvim, in a
// see-through dialog over the app. When nvim exits, the buffer is pasted into that
// terminal (bracketed, so nothing is submitted); an empty buffer or `:cq`
// pastes nothing.
//
// A spare nvim waits in a hidden terminal so the dialog opens at once; the
// next spare starts while the current one is in use.
//
// Herdr has no command to type text into a terminal without Enter, so the
// paste goes through the clipboard: editor.lua fills it on every write, and the
// one from before the dialog opened is put back afterwards (text only).
//
// `hc wait` hears the exit ~20 ms after it happens; the app's own terminals()
// and its auto-closing of the dialog lag ~200 ms, so the dialog is closed here.
//
// The layout holds one listening copy in a 0px block.

import { View, div } from "gpui-kit";
import { appHome, checking, closeOverlay, exec, focused, hc, home, nextCommand, notify, openOverlay, readTextFile, run, theme } from "herdr";

const DIR = `${home()}/.cache/nvim-input`;
const PREFIX = "nvim-input-";
const NVIM = ["nvim", "-n", "-i", "NONE", `+source ${appHome()}/mods/nvim-input/editor.lua`, "+startinsert"];
const BACKDROP = "c8";

const tint = (color, alpha) => (/^#[0-9a-f]{6}$/i.test(color) ? color + alpha : color);

function fail(body) {
  notify({ title: "nvim input", body, level: "error" });
}

async function json(promise) {
  try {
    return JSON.parse((await promise).stdout || "null");
  } catch (_) {
    return null;
  }
}

export default class NvimInput extends View {
  init(_props, cx) {
    if (checking()) return;
    this.next = this.reset().then(() => this.spare());
    this.next.catch((e) => fail(String(e?.message ?? e)));
    cx.spawn(async (cx) => {
      for (;;) {
        await nextCommand();
        if (this.busy) continue;
        this.busy = true;
        try {
          await this.edit(cx);
        } catch (e) {
          fail(String(e?.message ?? e));
        } finally {
          this.busy = false;
        }
      }
    });
  }

  async reset() {
    await exec("mkdir", ["-p", DIR]);
    const old = (await json(hc(["ls", "--all", "--json"])))?.terminals ?? [];
    for (const t of old.filter((t) => t.name?.startsWith(PREFIX))) {
      if (t.state === "live") await hc(["kill", t.address]);
      await hc(["rm", t.address]);
    }
  }

  async spare() {
    const stamp = Date.now();
    const file = `${DIR}/${stamp}.md`;
    const started = await json(
      hc(["run", "--bg", "--json", "--no-parent", "--no-notify", "--name", `${PREFIX}${stamp}`, "--cwd", DIR, ...NVIM, file]),
    );
    if (!started?.address) throw new Error("nvim did not start");
    return { address: started.address, file };
  }

  async edit(cx) {
    const from = focused();
    if (!from?.terminal) return;
    const editor = await this.next.catch(() => this.spare());

    const t = theme();
    const dialog = openOverlay({
      kind: "dialog",
      modal: true,
      frame: "none",
      width: 640,
      height: 540,
      layout: {
        type: "block",
        background: tint(t.background, BACKDROP),
        border: { width: 1, color: "accent" },
        radius: 12,
        shadow: "lg",
        content: { terminal: editor.address },
      },
    });
    this.next = this.spare();
    this.next.catch(() => {});
    const saved = `${DIR}/${editor.address}.clipboard`;
    const saving = exec("sh", ["-c", 'pbpaste > "$1"', "sh", saved]).catch(() => null);

    let ended;
    do {
      ended = await json(exec("hc", ["wait", "--json", "--timeout", "550", editor.address], { timeout: 600_000 }));
    } while (ended && !ended.ended);

    closeOverlay(dialog);
    run("pane.focus", from.pane ? { pane: from.pane } : { terminal: from.terminal });
    const text = ended?.exit_code === 0 ? ((await readTextFile(editor.file)) ?? "").trimEnd() : "";
    if (text) run("terminal.paste");

    cx.spawn(async (cx) => {
      await hc(["rm", editor.address]);
      if (text) await cx.sleep(300);
      await saving;
      await exec("sh", ["-c", '[ -f "$2" ] && pbcopy < "$2"; rm -f "$1" "$2"', "sh", editor.file, saved]);
    });
  }

  render() {
    return div();
  }
}
