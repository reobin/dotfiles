import { exec, panes, terminals, shared, setShared, home, appHome, readTextFile } from "herdr";
import * as fs from "fs/promises";
import { SVGS } from "./icons.js";

export const KEY = "status-tabs.work";
export const ICONS = "data/status-tabs/icons";

export async function installIcons() {
  const dir = `${appHome()}/${ICONS}`;
  await fs.mkdir(dir, { recursive: true });
  let wrote = false;
  for (const [name, text] of Object.entries(SVGS)) {
    const path = `${dir}/${name}.svg`;
    if (await fs.readFile(path, "utf8").catch(() => null) === text) continue;
    await fs.writeFile(path, text);
    wrote = true;
  }
  return wrote;
}

const PR_FIELDS = "number,title,url,state,isDraft,reviewDecision,mergeable,mergeStateStatus,headRefName,baseRefName,additions,deletions,changedFiles,updatedAt,latestReviews,reviewRequests,statusCheckRollup,body";
const BRANCH_ID = /(?:^|[/_])([a-z][a-z0-9]{1,4})-(\d{1,6})(?=$|[-_/])/i;
const TEXT_ID = /\b([A-Z][A-Z0-9]{1,4}-\d{1,6})\b/;
const LINEAR_URL = /linear\.app\/[^/\s]+\/issue\/([A-Za-z][A-Za-z0-9]{1,4}-\d{1,6})/;
const KEY_FILE = ".config/linear/api-key";
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

let apiKey, apiKeyAt = 0;
async function linearKey() {
  if (apiKey || Date.now() - apiKeyAt < 300000) return apiKey;
  apiKeyAt = Date.now();
  const env = await exec("printenv", ["LINEAR_API_KEY"]).catch(() => null);
  apiKey = env?.code === 0 ? env.stdout.trim() : null;
  // The key is exported from ~/.zshrc.private, which only an interactive zsh reads.
  if (!apiKey) {
    const zsh = await exec("zsh", ["-ic", "print -r -- \"$LINEAR_API_KEY\""]).catch(() => null);
    apiKey = zsh?.stdout.trim().split("\n").pop() || null;
  }
  if (!apiKey) apiKey = (await readTextFile(`${home()}/${KEY_FILE}`).catch(() => null))?.trim() || null;
  return apiKey;
}

async function linear(query, variables) {
  const key = await linearKey();
  if (!key) return null;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

let teamKeys = null;
async function teams() {
  if (teamKeys) return teamKeys;
  const data = await linear("{ teams(first: 250) { nodes { key } } }");
  if (data) teamKeys = new Set(data.teams.nodes.map((t) => t.key.toUpperCase()));
  return teamKeys;
}

function checkResult(c) {
  if (c.__typename === "StatusContext") {
    return { SUCCESS: "pass", FAILURE: "fail", ERROR: "fail" }[c.state] ?? "pending";
  }
  if (c.status !== "COMPLETED") return "pending";
  return { SUCCESS: "pass", NEUTRAL: "skip", SKIPPED: "skip", STALE: "skip" }[c.conclusion] ?? "fail";
}

const ORDER = { fail: 0, pending: 1, pass: 2, skip: 3 };

// GitHub's mergeStateStatus names one blocker (BEHIND hides a failing required check),
// so every blocker is checked here and the PR is mergeable only when none is left.
function mergeState(raw, required) {
  if (raw.state !== "OPEN" || raw.isDraft) return null;
  const reasons = [];
  if (raw.mergeable === "CONFLICTING" || raw.mergeStateStatus === "DIRTY") reasons.push(`conflicts with ${raw.baseRefName}`);
  if (required) {
    const names = (bucket) => [...new Set(required.filter((c) => bucket.includes(c.bucket)).map((c) => c.name))].join(", ");
    const failing = names(["fail", "cancel"]), running = names(["pending"]);
    if (failing) reasons.push(`${failing} failing`);
    if (running) reasons.push(`${running} running`);
  }
  if (raw.reviewDecision === "CHANGES_REQUESTED") reasons.push("changes requested");
  if (raw.reviewDecision === "REVIEW_REQUIRED") reasons.push("needs approval");
  if (raw.mergeStateStatus === "BEHIND") reasons.push(`behind ${raw.baseRefName}`);
  if (raw.mergeStateStatus === "BLOCKED" && !reasons.length) reasons.push("blocked by branch rules");
  if (reasons.length) return { ok: false, reasons };
  return ["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(raw.mergeStateStatus) ? { ok: true, reasons } : { ok: null, reasons };
}

function shapePr(raw, required) {
  const requiredIds = new Set((required ?? []).map((c) => `${c.workflow ?? ""}/${c.name}`));
  const latest = new Map();
  for (const c of raw.statusCheckRollup ?? []) {
    const name = c.name ?? c.context ?? "check";
    const id = `${c.workflowName ?? ""}/${name}`;
    const at = c.startedAt ?? c.createdAt ?? "";
    if (!latest.has(id) || at >= latest.get(id).at) {
      latest.set(id, { name, workflow: c.workflowName || null, result: checkResult(c), url: c.detailsUrl ?? c.targetUrl ?? null, required: requiredIds.has(id), at });
    }
  }
  const checks = [...latest.values()].sort((a, b) => ORDER[a.result] - ORDER[b.result] || a.name.localeCompare(b.name));
  const count = (r) => checks.filter((c) => c.result === r).length;
  const fail = count("fail"), pending = count("pending"), pass = count("pass");
  const reviews = (raw.latestReviews ?? []).map((r) => ({ login: r.author?.login ?? "?", state: r.state }));
  const decision = raw.reviewDecision || (reviews.some((r) => r.state === "APPROVED") ? "APPROVED" : null);
  return {
    number: raw.number, title: raw.title, url: raw.url, body: raw.body ?? "",
    state: raw.isDraft && raw.state === "OPEN" ? "draft" : raw.state.toLowerCase(),
    branch: raw.headRefName, base: raw.baseRefName,
    additions: raw.additions, deletions: raw.deletions, files: raw.changedFiles, updatedAt: raw.updatedAt,
    checks: checks.map(({ at, ...c }) => c),
    ci: { result: fail ? "fail" : pending ? "pending" : pass ? "pass" : null, fail, pending, pass, total: fail + pending + pass },
    review: { APPROVED: "approved", CHANGES_REQUESTED: "changes", REVIEW_REQUIRED: "waiting" }[decision] ?? null,
    reviews,
    requested: (raw.reviewRequests ?? []).map((r) => r.login ?? r.name ?? r.slug).filter(Boolean),
    merge: mergeState(raw, required),
  };
}

async function requiredChecks(t) {
  const r = await exec("gh", ["pr", "checks", t.pr ?? t.prBranch, "--required", "--json", "name,workflow,bucket"], { cwd: t.prCwd, on: t.on }).catch(() => null);
  try { return r?.stdout.trim().startsWith("[") ? JSON.parse(r.stdout) : null; } catch { return null; }
}

async function loadPr(t) {
  const r = await exec("gh", ["pr", "view", t.pr ?? t.prBranch, "--json", PR_FIELDS], { cwd: t.prCwd, on: t.on });
  if (r.code === 0) return { pr: shapePr(JSON.parse(r.stdout), await requiredChecks(t)) };
  if (/no pull requests found/i.test(r.stderr)) return { pr: null };
  return { pr: null, prError: (r.stderr || r.stdout).trim().split("\n")[0] || `gh exited ${r.code}` };
}

const ISSUE_QUERY = `query($id: String!) { issue(id: $id) {
  identifier title url description priority priorityLabel
  state { name type color } assignee { displayName name } project { name } cycle { number name }
  labels { nodes { name color } } attachments { nodes { url title sourceType } } } }`;

async function resolveTicket(label, branch, pr) {
  const found = [];
  let keys = null, linearError = null;
  try { keys = await teams(); } catch (e) { linearError = String(e.message ?? e); }
  const add = (id, source) => {
    if (id && (!keys || keys.has(id.split("-")[0].toUpperCase()))) found.push({ id: id.toUpperCase(), source });
  };

  add(label, "terminal label");
  const fromBranch = BRANCH_ID.exec(branch ?? "");
  if (fromBranch) add(`${fromBranch[1]}-${fromBranch[2]}`, "branch name");
  if (pr) {
    add(LINEAR_URL.exec(pr.body)?.[1], "PR description");
    add(TEXT_ID.exec(pr.title)?.[1], "PR title");
  }
  if (keys && branch && !found.length) {
    try {
      const data = await linear("query($b: String!) { issueVcsBranchSearch(branchName: $b) { identifier } }", { b: branch });
      add(data?.issueVcsBranchSearch?.identifier, "Linear branch link");
    } catch (e) { linearError = String(e.message ?? e); }
  }
  if (!found.length) return null;

  const id = found[0].id;
  const sources = [...new Set(found.filter((f) => f.id === id).map((f) => f.source))];
  let issue = null;
  if (keys) {
    try { issue = (await linear(ISSUE_QUERY, { id }))?.issue ?? null; }
    catch (e) { linearError = String(e.message ?? e); }
  }
  return { id, sources, issue, linear: issue ? "ok" : linearError ? "error" : keys ? "missing" : "nokey", linearError };
}

const running = new Set();

const KEEP_MS = 3600000;

// Entries are cached by what they were looked up from, so moving focus between panes
// shows the other PR at once instead of blanking until a fetch lands.
export function refresh(space) {
  const t = target(space);
  if (!space || running.has(t.key)) return null;
  running.add(t.key);
  return (async () => {
    try {
      const pr = t.pr || (t.prBranch && t.prCwd) ? await loadPr(t).catch((e) => ({ pr: null, prError: String(e.message ?? e) })) : { pr: null };
      const ticket = await resolveTicket(t.ticket, t.branch, pr.pr).catch(() => null);
      if (pr.pr) delete pr.pr.body;
      const entry = { key: t.key, branch: t.prBranch, at: Date.now(), ...pr, ticket };
      const all = shared(KEY) ?? {};
      const { at: _old, ...before } = all[t.key] ?? {};
      const { at: _new, ...after } = entry;
      if (JSON.stringify(before) === JSON.stringify(after) && all[t.key]) return;
      const kept = Object.fromEntries(Object.entries(all).filter(([k, e]) => k.includes("|") && entry.at - (e?.at ?? 0) < KEEP_MS));
      setShared(KEY, { ...kept, [t.key]: entry });
    } finally {
      running.delete(t.key);
    }
  })();
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
