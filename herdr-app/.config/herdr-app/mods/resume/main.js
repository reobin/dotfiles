// Brings back the Claude Code session a terminal lost to a reboot or a core
// restart, like the TUI's resume_agents_on_restore. Each running session
// (Claude's own ~/.claude/sessions/<pid>.json) is kept as labels on its
// terminal, with the pid of the shell it ran under. A labeled terminal back at
// a shell with another pid lost its agent, so the resume command is typed into
// it; the same shell means the session was quit, so its labels go. Draws
// nothing: the layout holds one copy in a 0px block, so only one copy acts.

import { View, div } from "gpui-kit";
import { terminals, hc, home, readTextFile, notify } from "herdr";

const SESSION = "resume.session";
const CWD = "resume.cwd";
const SHELL = "resume.shell";
const FLAGS = "resume.flags";
const KEYS = [SESSION, CWD, SHELL, FLAGS];

const BARE_FLAGS = new Set(["--dangerously-skip-permissions"]);
const VALUE_FLAGS = new Set(["--model", "--permission-mode"]);
const SAFE = /^[A-Za-z0-9._:@+-]+$/;

function keptFlags(argv) {
  const kept = [];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    if (BARE_FLAGS.has(arg)) kept.push(arg);
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[++i] ?? "";
      if (SAFE.test(value)) kept.push(arg, value);
    } else if (eq > 0 && VALUE_FLAGS.has(arg.slice(0, eq)) && SAFE.test(arg.slice(eq + 1))) kept.push(arg);
  }
  return kept.join(" ");
}

const isClaude = (t) => t.report?.app === "claude-code";
const quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;

async function inspect(address) {
  return JSON.parse((await hc(["get", address, "--json"])).stdout || "{}");
}

export default class Resume extends View {
  init(_props, cx) {
    this.busy = false;
    // A lost terminal is resumed on the tick after the one that first saw it,
    // so its new shell has had time to finish its rc files.
    this.lost = new Set();
    cx.timer.every(10000, (cx) => this.tick(cx));
    this.tick(cx);
  }

  tick(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async () => {
      try {
        await this.pass();
      } finally {
        this.busy = false;
      }
    });
  }

  async pass() {
    const all = terminals().filter((t) => !t.address.includes("/") && t.state === "live");
    const running = new Set(all.filter((t) => isClaude(t)).map((t) => t.labels?.[SESSION]).filter(Boolean));
    const resumed = [];
    const failed = [];
    const seen = new Set();
    for (const t of all) {
      if (!isClaude(t) && !t.labels?.[SESSION]) continue;
      try {
        const info = await inspect(t.address);
        if (!info.pid) continue;
        const fg = info.foreground;
        const atShell = !fg || fg.pid === info.pid;
        if (!atShell && (fg.name === "claude" || isClaude(t))) {
          const ok = await this.record(info, fg);
          if (!ok && isClaude(t) && fg.name === "claude" && !this.warned) {
            this.warned = true;
            notify({ title: "Resume can't read Claude's session file", body: `~/.claude/sessions/${fg.pid}.json`, level: "warning" });
          }
          continue;
        }
        const labels = info.labels ?? {};
        if (!labels[SESSION]) continue;
        if (labels[SHELL] === String(info.pid)) {
          await hc(["label", info.address, ...KEYS.map((k) => `${k}=`)]);
          continue;
        }
        if (!atShell || running.has(labels[SESSION])) continue;
        if (!this.lost.has(info.address)) {
          seen.add(info.address);
          continue;
        }
        const name = labels.callsign ?? info.address;
        if ((await this.resume(info, labels)) === 0) {
          running.add(labels[SESSION]);
          resumed.push(name);
        } else failed.push(name);
      } catch (e) {
        console.log(`resume: ${t.address}: ${e?.message ?? e}`);
      }
    }
    this.lost = seen;
    if (resumed.length) {
      notify({ title: `Resumed ${resumed.length} Claude session${resumed.length > 1 ? "s" : ""}`, body: resumed.join(", "), level: "success" });
    }
    if (failed.length) notify({ title: "Could not resume Claude", body: failed.join(", "), level: "error" });
  }

  // False only when Claude's file is missing or lacks what a resume needs:
  // the sign that a Claude update moved or reshaped it.
  async record(info, fg) {
    const raw = await readTextFile(`${home()}/.claude/sessions/${fg.pid}.json`);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!SAFE.test(session.sessionId ?? "") || !session.cwd) return false;
    if (session.kind !== "interactive") return true;
    const want = {
      [SESSION]: session.sessionId,
      [CWD]: session.cwd,
      [SHELL]: String(info.pid),
      [FLAGS]: keptFlags(fg.argv ?? []),
    };
    const have = info.labels ?? {};
    const changed = KEYS.filter((k) => (have[k] ?? "") !== want[k]);
    if (changed.length) await hc(["label", info.address, ...changed.map((k) => `${k}=${want[k]}`)]);
    return true;
  }

  // The shell's pid is recorded before typing, so a resume that fails to
  // start reads as a quit on the next pass instead of being retried forever.
  async resume(info, labels) {
    const flags = (labels[FLAGS] ?? "").split(" ").filter(Boolean);
    if (!SAFE.test(labels[SESSION]) || !flags.every((f) => SAFE.test(f.replace("=", "")))) return 1;
    const line = ["cd", quote(labels[CWD]), "&&", "claude", "--resume", labels[SESSION], ...flags].join(" ");
    await hc(["label", info.address, `${SHELL}=${info.pid}`]);
    return (await hc(["send", info.address, line])).code;
  }

  render() {
    return div();
  }
}
