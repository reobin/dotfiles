// Codex reads the terminal's colors once at startup, so after a light/dark
// switch it keeps the old palette. This quits the focused Codex, clears the
// pane and its scrollback (where old messages keep their old colors), and
// resumes the same session. Draws nothing: the layout holds one copy in a 0px
// block, so only one copy listens.

import { View, div } from "gpui-kit";
import { focused, hc, notify, nextCommand } from "herdr";

const CODEX_FLAGS = {
  value: new Set(["-m", "--model", "-p", "--profile", "-s", "--sandbox", "-a", "--ask-for-approval", "-c", "--config", "--enable", "--disable", "--add-dir"]),
  bare: new Set(["--dangerously-bypass-approvals-and-sandbox", "--approve-for-me", "--search", "--no-alt-screen", "--no-daemon"]),
};
const SAFE = /^[A-Za-z0-9._:@+=\/-]+$/;
const quote = (s) => (SAFE.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

function keptFlags(argv, { value, bare }) {
  const kept = [];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    if (bare.has(arg)) kept.push(arg);
    else if (value.has(arg) && i + 1 < argv.length) kept.push(arg, argv[++i]);
    else if (eq > 0 && value.has(arg.slice(0, eq))) kept.push(arg);
  }
  return kept;
}

async function inspect(address) {
  return JSON.parse((await hc(["get", address, "--json"])).stdout || "{}");
}

export default class CodexReload extends View {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        await nextCommand();
        try {
          await this.reload(cx);
        } catch (e) {
          notify({ title: "Codex reload", body: e?.message ?? String(e), level: "error" });
        }
      }
    });
  }

  async reload(cx) {
    const address = focused()?.terminal;
    if (!address) throw new Error("no focused pane");

    const info = await inspect(address);
    const fg = info.foreground;
    if (fg?.name !== "codex") throw new Error("focused pane is not running codex");
    if (["working", "blocked"].includes(info.status?.state)) throw new Error("codex is mid-turn: wait for it to finish");
    // No label means no prompt yet, so there is nothing to resume: start fresh.
    const id = info.labels?.["codex.session"];

    // The shell's codex alias adds --no-daemon itself.
    const flags = keptFlags(fg.argv ?? [], CODEX_FLAGS).filter((f) => f !== "--no-daemon");

    // Ctrl-D quits only while the composer is empty, so a draft is never lost.
    await hc(["keys", address, "ctrl+d"]);
    for (let waited = 0; ; waited += 100) {
      if ((await inspect(address)).foreground?.pid === info.pid) break;
      if (waited >= 3000) throw new Error("codex did not quit: clear its input box and try again");
      await cx.sleep(100);
    }

    const codex = id ? ["codex", "resume", quote(id)] : ["codex"];
    const line = ["clear", "&&", "printf", quote("\\e[3J"), "&&", ...codex, ...flags.map(quote)].join(" ");
    const sent = await hc(["send", address, line]);
    if (sent.code !== 0) throw new Error(sent.stderr.trim() || "could not type the codex command");
    // Codex's SessionStart hook waits for the first prompt, so a second reload before it would find no label.
    if (id) await hc(["label", address, `codex.session=${id}`]);
  }

  render() {
    return div();
  }
}
