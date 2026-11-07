// Copied from status-tabs/status.js, which fetches the data and installs the icons:
// Herdr mods can't import from another mod's folder. Keep the two in sync.
import { exec, panes, shared } from "herdr";

const KEY = "status-tabs.work";
export const ICONS = "data/status-tabs/icons";

export const entryFor = (spaceId) => (shared(KEY) ?? {})[spaceId] ?? null;

// The ticket and PR follow the space's first pane, which is where its worktree lives.
export function target(space) {
  const tab = space?.tabs?.[0];
  const pane = tab ? panes().find((p) => p.tab === tab.id && p.terminal) : null;
  return { cwd: pane?.cwd || space?.folder || null, branch: pane?.branch || space?.branch || null, on: space?.machine ?? null };
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
