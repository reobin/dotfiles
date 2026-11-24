// The key lookup is copied from status-tabs/status.js: mods can't import across folders.
import { exec, home, readTextFile } from "herdr";

const KEY_FILE = ".config/linear/api-key";
const TYPE_ORDER = { triage: 0, backlog: 1, unstarted: 2, started: 3, completed: 4, canceled: 5 };
const KEEP_MS = 600000;

let apiKey, apiKeyAt = 0;
async function linearKey() {
  if (apiKey || Date.now() - apiKeyAt < 300000) return apiKey;
  apiKeyAt = Date.now();
  const env = await exec("printenv", ["LINEAR_API_KEY"]).catch(() => null);
  apiKey = env?.code === 0 ? env.stdout.trim() : null;
  if (!apiKey) {
    const zsh = await exec("zsh", ["-ic", "print -r -- \"$LINEAR_API_KEY\""]).catch(() => null);
    apiKey = zsh?.stdout.trim().split("\n").pop() || null;
  }
  if (!apiKey) apiKey = (await readTextFile(`${home()}/${KEY_FILE}`).catch(() => null))?.trim() || null;
  return apiKey;
}

async function linear(query, variables) {
  const key = await linearKey();
  if (!key) throw new Error("no Linear API key");
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const cache = new Map();
function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.value;
  const value = load().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export const viewer = () => cached("viewer", async () => (await linear("{ viewer { id displayName name } }")).viewer);

export const states = (team) => cached(`states:${team}`, async () => {
  const data = await linear("query($t: String!) { team(id: $t) { states(first: 100) { nodes { id name type color position } } } }", { t: team });
  return data.team.states.nodes.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || a.position - b.position);
});

export const members = (team) => cached(`members:${team}`, async () => {
  const data = await linear("query($t: String!) { team(id: $t) { members(first: 250) { nodes { id name displayName active } } } }", { t: team });
  return data.team.members.nodes.filter((m) => m.active).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
});

// A team's own labels and the workspace's; group labels only hold others.
export const labels = (team) => cached(`labels:${team}`, async () => {
  const data = await linear(`query($t: String!) {
    team(id: $t) { labels(first: 250) { nodes { id name color isGroup parent { name } } } }
    issueLabels(first: 250, filter: { team: { null: true } }) { nodes { id name color isGroup parent { name } } } }`, { t: team });
  const seen = new Set();
  return [...data.team.labels.nodes, ...data.issueLabels.nodes]
    .filter((l) => !l.isGroup && !seen.has(l.id) && seen.add(l.id))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const PRIORITIES = [
  { value: 0, name: "no priority", icon: "prio-none" },
  { value: 1, name: "urgent", icon: "prio-urgent" },
  { value: 2, name: "high", icon: "prio-high" },
  { value: 3, name: "medium", icon: "prio-medium" },
  { value: 4, name: "low", icon: "prio-low" },
];

export async function updateIssue(id, input) {
  const data = await linear("mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }", { id, input });
  if (!data.issueUpdate.success) throw new Error("Linear refused the change");
}

export async function comment(issueId, body) {
  const data = await linear("mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }", { input: { issueId, body } });
  if (!data.commentCreate.success) throw new Error("Linear refused the comment");
}
