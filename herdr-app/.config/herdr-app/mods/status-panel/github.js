import { exec } from "herdr";

const KEEP_MS = 600000;
const cache = new Map();

// Each call names the PR by URL, so gh needs no checkout; `on` runs it where the space lives.
async function gh(work, args) {
  const r = await exec("gh", args, { cwd: work.prCwd ?? undefined, on: work.on, timeout: 60000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n")[0] || `gh exited ${r.code}`);
  return r.stdout;
}

const repoOf = (pr) => { const m = /github\.com\/([^/]+)\/([^/]+)\/pull\//.exec(pr.url); return m ? `${m[1]}/${m[2]}` : null; };

function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.value;
  const value = load().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), value });
  return value;
}

const USERS = `query($owner: String!, $name: String!, $endCursor: String) { repository(owner: $owner, name: $name) {
  assignableUsers(first: 100, after: $endCursor) { nodes { login name } pageInfo { hasNextPage endCursor } } } }`;

export const users = (work, pr) => cached(`users:${repoOf(pr)}`, async () => {
  const [owner, name] = repoOf(pr).split("/");
  const out = await gh(work, ["api", "graphql", "--paginate", "-f", `query=${USERS}`, "-F", `owner=${owner}`, "-F", `name=${name}`,
    "--jq", ".data.repository.assignableUsers.nodes[] | [.login, (.name // \"\")] | @tsv"]);
  return out.trim().split("\n").filter(Boolean).map((line) => { const [login, full] = line.split("\t"); return { login, name: full || null }; })
    .sort((a, b) => a.login.localeCompare(b.login));
});

export const repoLabels = (work, pr) => cached(`labels:${repoOf(pr)}`, async () =>
  JSON.parse(await gh(work, ["label", "list", "-R", repoOf(pr), "--limit", "300", "--json", "name,color"]))
    .sort((a, b) => a.name.localeCompare(b.name)));

const mergeMethod = (work, pr) => cached(`merge:${repoOf(pr)}`, async () => {
  const r = JSON.parse(await gh(work, ["repo", "view", repoOf(pr), "--json", "squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed"]));
  return r.squashMergeAllowed ? "squash" : r.mergeCommitAllowed ? "merge" : "rebase";
});

export const MERGE_LABEL = { squash: "Squash and merge", merge: "Merge", rebase: "Rebase and merge" };
export { mergeMethod };

export const setReviewer = (work, pr, login, on) => gh(work, ["pr", "edit", pr.url, on ? "--add-reviewer" : "--remove-reviewer", login]);
export const setLabel = (work, pr, name, on) => gh(work, ["pr", "edit", pr.url, on ? "--add-label" : "--remove-label", name]);
export const setDraft = (work, pr, draft) => gh(work, ["pr", "ready", pr.url, ...(draft ? ["--undo"] : [])]);
export const comment = (work, pr, body) => gh(work, ["pr", "comment", pr.url, "--body", body]);

// The conversation's own comments, not review threads on lines; hidden ones stay hidden.
export async function comments(work, pr) {
  const list = JSON.parse(await gh(work, ["pr", "view", pr.url, "--json", "comments"])).comments ?? [];
  return list.filter((c) => !c.isMinimized).map((c) => ({ id: c.id, who: c.author?.login ?? "ghost", body: c.body ?? "", createdAt: c.createdAt }));
}
export const merge =(work, pr, method) => gh(work, ["pr", "merge", pr.url, `--${method}`]);

// Failing checks link to their job; a run is rerun once, for its failed jobs only.
export function failedRuns(pr) {
  const ids = pr.checks.filter((c) => c.result === "fail").map((c) => /\/actions\/runs\/(\d+)/.exec(c.url ?? "")?.[1]).filter(Boolean);
  return [...new Set(ids)];
}

export async function rerunFailed(work, pr) {
  for (const id of failedRuns(pr)) await gh(work, ["run", "rerun", id, "--failed", "-R", repoOf(pr)]);
}
