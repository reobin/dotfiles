// Smart split: one key splits where it makes most sense, right when the
// focused pane is wide, down when it is tall. Same geometry rule as the
// TUI's herdr-smart-split (terminal cells run about 2:1 tall:wide, so the
// width needs twice the rows to read side by side; a picked half that
// would be a sliver loses to the other axis). `split` starts a fresh
// session of the focused pane's agent (claude, codex or pi, same launch
// flags) and falls back to a shell; `shell` always opens a shell; `editor` opens
// nvim in the focused pane's folder. Draws nothing: the layout holds one
// copy in a 0px block, so only one copy ever listens.

import { View, div } from "gpui-kit";
import { focused, hc, notify, run, nextCommand } from "herdr";

const AGENT_FLAGS = {
  claude: {
    value: new Set(["--model", "--permission-mode", "--effort", "--settings"]),
    bare: new Set(["--dangerously-skip-permissions", "--allow-dangerously-skip-permissions"]),
  },
  codex: {
    value: new Set(["-m", "--model", "-p", "--profile", "-s", "--sandbox", "-a", "--ask-for-approval", "-c", "--config", "--enable", "--disable", "--add-dir"]),
    bare: new Set(["--dangerously-bypass-approvals-and-sandbox", "--approve-for-me", "--search", "--no-alt-screen", "--no-daemon"]),
  },
  pi: { value: new Set(["--provider", "--model", "--thinking"]), bare: new Set() },
};

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

function agentArgv(fg) {
  const flags = AGENT_FLAGS[fg?.name];
  if (!flags) return null;
  const kept = keptFlags(fg.argv ?? [], flags);
  // A shared Codex daemon keeps another terminal's Herdr environment.
  if (fg.name === "codex" && !kept.includes("--no-daemon")) kept.push("--no-daemon");
  return [fg.name, ...kept];
}

export default class SmartSplit extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        await this.split(command);
      }
    });
  }

  async split(command) {
    const f = focused();
    let direction = "right";
    let info = {};
    try {
      if (f?.terminal) {
        info = JSON.parse((await hc(["get", f.terminal, "--json"])).stdout || "{}");
        const cols = Number(info.cols);
        const rows = Number(info.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
          direction = cols >= rows * 2 ? "right" : "down";
          if (direction === "right" && cols / 2 < 20) direction = "down";
          if (direction === "down" && rows / 2 < 6) direction = "right";
        }
      }
    } catch (e) {
      notify({ title: "smart split", body: `could not read terminal size: ${e?.message ?? e}`, level: "error" });
      return;
    }
    const argv = command === "editor" ? ["nvim"] : command === "shell" ? null : agentArgv(info.foreground);
    if (argv) {
      run("terminal.open", { argv, folder: info.cwd, place: direction });
      return;
    }
    const args = { direction };
    if (f?.pane) args.pane = f.pane;
    run("pane.split", args);
  }

  render() {
    return div();
  }
}
