// Copied from status-tabs/status.js, which fetches the data and installs the icons:
// Herdr mods can't import from another mod's folder. Keep the two in sync.
import { exec, panes, terminals, shared, spaces, home } from "herdr";

const KEY = "status-tabs.work";
export const ICONS = "data/status-tabs/icons";
export const SANS = "Geist";
export const MONO = "JetBrains Mono";
const PR_LABEL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/;
const TICKET_LABEL = /^[A-Za-z][A-Za-z0-9]{1,4}-\d{1,6}$/;

export const entryFor = (work) => (work ? (shared(KEY) ?? {})[work.key] : null) ?? null;

// Agents label their terminal `ticket=<ID>` / `pr=<url>`: both follow the focused pane, falling
// back to the first pane, whose branch (its worktree) fills in the rest.
// The space the bar and panels follow: the shown one, none over an empty view,
// and in the archive the selected archived space, from the restore mod's record
// (the tree and space-nav keep the selection in archive.selected and archive.space).
export function shown() {
  const empty = shared("tree.empty");
  if (empty !== "archive") return empty ? null : spaces().find((s) => s.active) ?? null;
  const list = /** @type {any[]} */ (shared("restore.records") ?? []);
  const r = list.find((x) => x.id === shared("archive.selected")) ?? list[0];
  if (!r) return null;
  const at = /** @type {any} */ (shared("archive.space"));
  const i = at?.record === r.id ? Math.min(at.i, r.spaces.length - 1) : 0;
  const infos = r.spaces[i].tabs.flatMap((t) => Object.values(t.info));
  const lead = infos.find((p) => p.labels?.pr || p.labels?.ticket) ?? infos[0] ?? {};
  const cwd = lead.sessionCwd || lead.cwd || null;
  return { id: `archived:${r.id}:${i}`, tabs: [], machine: null, archived: { ticket: lead.labels?.ticket ?? null, pr: lead.labels?.pr ?? null, branch: lead.branch ?? null, cwd } };
}

export function target(space) {
  if (space?.archived) {
    const a = space.archived;
    const ticket = TICKET_LABEL.test(a.ticket ?? "") ? a.ticket : null, pr = PR_LABEL.test(a.pr ?? "") ? a.pr : null;
    // gh finds a PR by its URL from anywhere; its worktree may be gone.
    return { cwd: a.cwd, branch: a.branch, on: null, ticket, pr, prCwd: pr ? home() : a.cwd, prBranch: a.branch, key: [space.id, ticket, pr, a.branch, a.cwd].join("|") };
  }
  const tabs = space?.tabs ?? [];
  const inSpace = panes().filter((p) => p.terminal && tabs.some((t) => t.id === p.tab));
  const first = inSpace.find((p) => p.tab === tabs[0]?.id) ?? null;
  const labels = new Map(terminals().map((t) => [t.address, t.labels ?? {}]));
  const prOf = (p) => { const url = labels.get(p?.terminal)?.pr; return url && PR_LABEL.test(url) ? url : null; };
  const ticketOf = (p) => { const id = labels.get(p?.terminal)?.ticket; return id && TICKET_LABEL.test(id) ? id : null; };
  const active = tabs.find((t) => t.active);
  const focus = inSpace.find((p) => p.focused) ?? inSpace.find((p) => p.tab === active?.id);
  const pane = focus && (prOf(focus) || ticketOf(focus) || focus.branch) ? focus : first;
  const ticket = ticketOf(pane);
  const cwd = first?.cwd || space?.folder || null, branch = first?.branch || space?.branch || null;
  const pr = prOf(pane), prCwd = pane?.cwd || cwd, prBranch = pane === first ? branch : pane.branch;
  return { cwd, branch, on: space?.machine ?? null, ticket, pr, prCwd, prBranch, key: [space?.id, ticket, pr, prBranch, prCwd].join("|") };
}

export function ticketIcon(ticket) {
  const state = ticket?.issue?.state;
  return state ? stateIcon(state, ticket.issue.team?.states?.nodes) : "lin-unknown";
}

const STARTED_MAX = 12;

// `states` are the team's workflow states, which rank a started state to pick its pie.
export function stateIcon(state, states = []) {
  if (state.type === "started") {
    const started = states.filter((s) => s.type === "started").sort((a, b) => a.position - b.position);
    const i = started.findIndex((s) => s.id === state.id), d = started.length + 1;
    if (i < 0) return "lin-started-1-2";
    if (d <= STARTED_MAX) return `lin-started-${i + 1}-${d}`;
    return `lin-started-${Math.min(STARTED_MAX - 1, Math.max(1, Math.round(((i + 1) / d) * STARTED_MAX)))}-${STARTED_MAX}`;
  }
  return { backlog: "lin-backlog", triage: "lin-backlog", unstarted: "lin-todo", completed: "lin-done", canceled: "lin-canceled" }[state.type] ?? "lin-todo";
}

export function prIcon(pr) {
  return { merged: "pr-merged", closed: "pr-closed", draft: "pr-draft" }[pr.state] ?? "pr";
}

export function prColor(pr, t) {
  return { open: t.ansi2, draft: t.dim, merged: t.ansi5, closed: t.ansi1 }[pr.state] ?? t.muted;
}

export const REPOS = "status-tabs.repos";
export const REPO_SHOWN = "status-tabs.repo-shown";

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
  if (pr.state === "draft") return { icon: "pr-draft", color: t.dim, sentence: "draft: mark it ready for review to merge" };
  const { ok, reasons } = pr.merge ?? {};
  if (ok) return { icon: "merge-ready", color: t.ansi2, sentence: pr.ci.fail ? "mergeable; only non-required checks are failing" : "mergeable" };
  if (ok === false) {
    // Red: something on the PR needs fixing. Yellow: it's waiting on reviewers, CI or a branch update.
    const conflict = reasons.some((r) => r.startsWith("conflicts"));
    const broken = conflict || reasons.some((r) => r.endsWith("failing") || r === "changes requested");
    return { icon: conflict ? "conflict" : "merge-blocked", color: broken ? t.ansi1 : t.ansi3, sentence: `not mergeable: ${reasons.join(", ")}` };
  }
  return { icon: "pend", color: t.dim, sentence: "GitHub is still checking mergeability" };
}
