// Copied from status-tabs/status.js, which fetches the data and installs the icons:
// Herdr mods can't import from another mod's folder. Keep the two in sync.
import { exec, panes, terminals, shared } from "herdr";

const KEY = "status-tabs.work";
export const ICONS = "data/status-tabs/icons";
const PR_LABEL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/;
const TICKET_LABEL = /^[A-Za-z][A-Za-z0-9]{1,4}-\d{1,6}$/;

export const entryFor = (work) => (work ? (shared(KEY) ?? {})[work.key] : null) ?? null;

// Agents label their terminal `ticket=<ID>` / `pr=<url>`: the ticket is the space's, the PR
// follows the focused pane, and the first pane's branch (its worktree) fills in the rest.
export function target(space) {
  const tabs = space?.tabs ?? [];
  const inSpace = panes().filter((p) => p.terminal && tabs.some((t) => t.id === p.tab));
  const first = inSpace.find((p) => p.tab === tabs[0]?.id) ?? null;
  const labels = new Map(terminals().map((t) => [t.address, t.labels ?? {}]));
  const prOf = (p) => { const url = labels.get(p?.terminal)?.pr; return url && PR_LABEL.test(url) ? url : null; };
  const active = tabs.find((t) => t.active);
  const focus = inSpace.find((p) => p.focused) ?? inSpace.find((p) => p.tab === active?.id);
  const prPane = focus && (prOf(focus) || focus.branch) ? focus : first;
  const ticket = inSpace.map((p) => labels.get(p.terminal)?.ticket).find((id) => id && TICKET_LABEL.test(id)) ?? null;
  const cwd = first?.cwd || space?.folder || null, branch = first?.branch || space?.branch || null;
  const pr = prOf(prPane), prCwd = prPane?.cwd || cwd, prBranch = prPane === first ? branch : prPane.branch;
  return { cwd, branch, on: space?.machine ?? null, ticket, pr, prCwd, prBranch, key: [space?.id, ticket, pr, prBranch, prCwd].join("|") };
}

export function ticketIcon(ticket) {
  const state = ticket?.issue?.state;
  if (!state) return "lin-unknown";
  if (state.type === "started") return /review/i.test(state.name) ? "lin-review" : "lin-progress";
  return { backlog: "lin-backlog", triage: "lin-backlog", unstarted: "lin-todo", completed: "lin-done", canceled: "lin-canceled" }[state.type] ?? "lin-todo";
}

export function prIcon(pr) {
  return { merged: "pr-merged", closed: "pr-closed", draft: "pr-draft" }[pr.state] ?? "pr";
}

export function prColor(pr, t) {
  return { open: t.ansi2, draft: t.dim, merged: t.ansi5, closed: t.ansi1 }[pr.state] ?? t.muted;
}

export function ago(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function open(url) {
  if (url) exec("open", [url]).catch(() => {});
}

export function mergeLook(pr, t) {
  if (pr.state === "merged" || pr.state === "closed") return null;
  if (pr.state === "draft") return { icon: "pr-draft", color: t.dim, sentence: "Draft: mark it ready for review to merge" };
  const { ok, reasons } = pr.merge ?? {};
  if (ok) return { icon: "merge-ready", color: t.ansi2, sentence: pr.ci.fail ? "Mergeable; only non-required checks are failing" : "Mergeable" };
  if (ok === false) {
    // Red: something on the PR needs fixing. Yellow: it's waiting on reviewers, CI or a branch update.
    const conflict = reasons.some((r) => r.startsWith("conflicts"));
    const broken = conflict || reasons.some((r) => r.endsWith("failing") || r === "changes requested");
    return { icon: conflict ? "conflict" : "merge-blocked", color: broken ? t.ansi1 : t.ansi3, sentence: `Not mergeable: ${reasons.join(", ")}` };
  }
  return { icon: "pend", color: t.dim, sentence: "GitHub is still checking mergeability" };
}
