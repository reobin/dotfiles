// Sidetrack: forks the focused Claude Code session into a new pane from its
// last completed turn, leaving the original running untouched. Port of the
// TUI's herdr-sidetrack. Draws nothing: the layout holds one copy in a 0px
// block, so only one copy listens.

import { View, div } from "gpui-kit";
import { focused, panes, hc, home, appHome, readTextFile, exec, notify, run, nextCommand } from "herdr";
import { randomUUID } from "crypto";

// --settings is left out: the `claude` shell function adds it already.
const VALUE_FLAGS = new Set(["--model", "--permission-mode", "--effort"]);
const BARE_FLAGS = new Set(["--dangerously-skip-permissions", "--allow-dangerously-skip-permissions"]);

function keptFlags(argv) {
  const kept = [];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    if (BARE_FLAGS.has(arg)) kept.push(arg);
    else if (VALUE_FLAGS.has(arg) && i + 1 < argv.length) kept.push(arg, argv[++i]);
    else if (eq > 0 && VALUE_FLAGS.has(arg.slice(0, eq))) kept.push(arg);
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
    if (fg?.name !== "claude") throw new Error("focused pane is not running claude");

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
    let flags = keptFlags(fg.argv ?? []);
    if (effort) flags = [...withoutFlag(flags, "--effort"), "--effort", effort];
    if (mode) flags = [...withoutFlag(flags, "--permission-mode"), "--permission-mode", mode === "default" ? "manual" : mode];

    const place = this.place(f, info);
    run("terminal.open", {
      argv: ["claude", "--resume", forkId, ...flags],
      folder: session.cwd,
      place,
      ...(place === "tab" ? { name: "sidetrack" } : {}),
    });
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
