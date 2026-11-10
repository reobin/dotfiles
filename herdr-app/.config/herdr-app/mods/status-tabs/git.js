import { exec } from "herdr";

// Reads write nothing under .git, so the folder watch never wakes on its own refresh.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.quotePath=false"];
const MAX_UNTRACKED = 200;

// Porcelain paths are relative to the repo root, not the folder asked.
const top = async (cwd, on) => (await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on })).stdout.trim() || cwd;

// Changed files and where the branch stands. Without a live upstream, unpushed means
// commits on no remote at all.
export async function gitStatus(cwd, on) {
  const [r, stat] = await Promise.all([
    exec("git", [...READ, "status", "--porcelain=v2", "--branch", "--untracked-files=all", "--no-renames", "-z"], { cwd, on }),
    exec("git", [...READ, "diff", "--shortstat", "--no-renames", "--no-ext-diff", "HEAD"], { cwd, on }),
  ]);
  if (r.code !== 0) return null;
  const s = { files: 0, add: 0, del: 0, ahead: 0, behind: 0, upstream: null, detached: false };
  const untracked = [];
  let counted = false, oid = null;
  for (const line of r.stdout.split("\0")) {
    if (line.startsWith("# branch.oid ")) oid = line.slice(13, 20);
    else if (line.startsWith("# branch.head ")) { s.detached = line.slice(14) === "(detached)"; s.branch = s.detached ? oid : line.slice(14); }
    else if (line.startsWith("# branch.upstream ")) s.upstream = line.slice(18);
    else if (line.startsWith("# branch.ab ")) { [s.ahead, s.behind] = line.slice(12).split(" ").map((n) => Math.abs(+n)); counted = true; }
    else if (line.startsWith("? ")) { s.files++; untracked.push(line.slice(2)); }
    else if (line && !line.startsWith("#")) s.files++;
  }
  s.add = +(/(\d+) insertion/.exec(stat.stdout)?.[1] ?? 0);
  s.del = +(/(\d+) deletion/.exec(stat.stdout)?.[1] ?? 0);
  if (untracked.length) {
    const wc = await exec("awk", ["END { print NR }", ...untracked.slice(0, MAX_UNTRACKED)], { cwd: await top(cwd, on), on });
    s.add += +wc.stdout.trim() || 0;
  }
  if (s.upstream && !counted) s.gone = true;
  if (!counted && !s.detached) {
    const n = await exec("git", [...READ, "rev-list", "--count", "HEAD", "--not", "--remotes"], { cwd, on });
    s.ahead = n.code === 0 ? +n.stdout.trim() || 0 : 0;
  }
  return s;
}

export function describe(s) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [];
  if (s.files) parts.push(`${plural(s.files, "file")} changed, +${s.add} −${s.del}`);
  if (s.ahead) parts.push(`${plural(s.ahead, "commit")} not pushed`);
  if (s.behind) parts.push(`${s.behind} behind ${s.upstream}`);
  if (s.detached) parts.push("detached HEAD");
  else if (s.gone) parts.push(`${s.upstream} is gone`);
  else if (!s.upstream) parts.push("no upstream");
  if (!s.files && !s.ahead && !s.behind) parts.unshift(s.upstream && !s.gone ? `Clean, in sync with ${s.upstream}` : "Clean, nothing to push");
  return parts.join(" · ");
}
