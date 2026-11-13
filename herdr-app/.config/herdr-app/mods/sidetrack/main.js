// Sidetrack: forks the focused Claude Code, Codex or pi session into a new
// pane, leaving the original running untouched. A Claude fork starts from the
// last completed turn; Codex and pi fork natively. Port of the TUI's
// herdr-sidetrack. Draws nothing: the layout holds one copy in a 0px block, so
// only one copy listens.

import { View, div } from "gpui-kit";
import { focused, panes, hc, home, appHome, readTextFile, exec, notify, run, nextCommand } from "herdr";
import { randomUUID } from "crypto";

// --settings is left out: the `claude` shell function adds it already.
const CLAUDE_FLAGS = {
  value: new Set(["--model", "--permission-mode", "--effort"]),
  bare: new Set(["--dangerously-skip-permissions", "--allow-dangerously-skip-permissions"]),
};
const CODEX_FLAGS = {
  value: new Set(["-m", "--model", "-p", "--profile", "-s", "--sandbox", "-a", "--ask-for-approval", "-c", "--config", "--enable", "--disable", "--add-dir"]),
  bare: new Set(["--dangerously-bypass-approvals-and-sandbox", "--approve-for-me", "--search", "--no-alt-screen", "--no-daemon"]),
};
const PI_FLAGS = { value: new Set(["--provider", "--model", "--thinking"]), bare: new Set() };

// Codex's SessionStart hook and pi's herdr-session extension put these labels on their terminal.
const CODEX_SESSION = "codex.session";
const PI_SESSION = "pi.session";

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

function withoutFlag(flags, name) {
  const out = [];
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === name) i++;
    else if (!flags[i].startsWith(`${name}=`)) out.push(flags[i]);
  }
  return out;
}

export default class Sidetrack extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        await nextCommand();
        try {
          await this.fork();
        } catch (e) {
          notify({ title: "Sidetrack", body: e?.message ?? String(e), level: "error" });
        }
      }
    });
  }

  async fork() {
    const f = focused();
    if (!f?.pane || !f.terminal) throw new Error("no focused pane");

    const info = JSON.parse((await hc(["get", f.terminal, "--json"])).stdout || "{}");
    const fg = info.foreground;
    const target =
      fg?.name === "claude" ? await this.claude(fg)
      : fg?.name === "codex" ? this.codex(fg, info)
      : fg?.name === "pi" ? this.pi(fg, info)
      : null;
    if (!target) throw new Error("focused pane is not running claude, codex or pi");

    const place = this.place(f, info);
    run("terminal.open", { ...target, place, ...(place === "tab" ? { name: "sidetrack" } : {}) });
  }

  codex(fg, info) {
    const id = info.labels?.[CODEX_SESSION];
    if (!id) throw new Error("this codex has no session label yet: restart it so its SessionStart hook runs");
    const flags = keptFlags(fg.argv ?? [], CODEX_FLAGS);
    // A shared Codex daemon keeps another terminal's Herdr environment.
    if (!flags.includes("--no-daemon")) flags.push("--no-daemon");
    return { argv: ["codex", "fork", id, ...flags], folder: info.cwd };
  }

  pi(fg, info) {
    const file = info.labels?.[PI_SESSION];
    if (!file) throw new Error("this pi has no session label yet: restart it so the herdr-session extension runs");
    return { argv: ["pi", "--fork", file, ...keptFlags(fg.argv ?? [], PI_FLAGS)], folder: info.cwd };
  }

  async claude(fg) {
    const session = JSON.parse((await readTextFile(`${home()}/.claude/sessions/${fg.pid}.json`)) || "{}");
    if (!session.sessionId || !session.cwd) throw new Error(`no session recorded for claude pid ${fg.pid}`);

    const project = `${home()}/.claude/projects/${session.cwd.replace(/[^A-Za-z0-9]/g, "-")}`;
    const forkId = randomUUID();
    const trimmed = await exec("sh", [
      `${appHome()}/mods/sidetrack/trim.sh`,
      `${project}/${session.sessionId}.jsonl`,
      `${project}/${forkId}.jsonl`,
      forkId,
    ]);
    if (trimmed.code !== 0) throw new Error(trimmed.stderr.trim() || "could not trim the transcript");
    const [effort, mode] = trimmed.stdout.trim().split("\t");

    // Effort and permission mode are session state, so a mid-session change
    // wins over the parent's launch flags. The CLI calls the "default" mode "manual".
    let flags = keptFlags(fg.argv ?? [], CLAUDE_FLAGS);
    if (effort) flags = [...withoutFlag(flags, "--effort"), "--effort", effort];
    if (mode) flags = [...withoutFlag(flags, "--permission-mode"), "--permission-mode", mode === "default" ? "manual" : mode];

    return { argv: ["claude", "--resume", forkId, ...flags], folder: session.cwd };
  }

  // Alone in the tab, the pane is full width and has room to sit side by
  // side. Once it is sharing, halving the width again leaves columns too
  // narrow to read, so stack instead; a sliver goes to a new tab.
  place(f, info) {
    const cols = Number(info.cols);
    const rows = Number(info.rows);
    const alone = panes().filter((p) => p.tab === f.tab).length <= 1;
    if (alone) return cols / 2 >= 20 ? "right" : "tab";
    return rows / 2 >= 6 ? "down" : "tab";
  }

  render() {
    return div();
  }
}
