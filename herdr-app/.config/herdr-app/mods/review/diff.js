import { exec } from "herdr";

// Reads write nothing under .git, so a folder watch elsewhere never sees them.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotePath=false"];
const FLAGS = ["--no-color", "--no-relative", "--no-ext-diff", "--no-textconv", "--no-renames", "--src-prefix=a/", "--dst-prefix=b/", "-U3"];
const MAX_ROWS = 4000;
const MAX_UNTRACKED = 200;
// delta paints changed words with these backgrounds; the view swaps in theme colors.
const PLUS_EMPH = "#00ff01", MINUS_EMPH = "#ff0001";
const DELTA = `t="$1"; l="$2"; shift 2; if command -v delta >/dev/null; then git "$@" | head -n ${MAX_ROWS + 100} | delta --no-gitconfig --color-only --true-color always --max-line-length 0 --syntax-theme "$t" --default-language "$l" --zero-style syntax --plus-style syntax --minus-style syntax --plus-emph-style 'syntax "${PLUS_EMPH}"' --minus-emph-style 'syntax "${MINUS_EMPH}"'; else git "$@" | head -n ${MAX_ROWS + 100}; fi`;

async function git(root, on, args) {
  const r = await exec("git", [...READ, ...args], { cwd: root, on });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || `git ${args[0]} failed`);
  return r.stdout;
}

// Prints the root even when HEAD is missing (a repo with no commits), then fails the HEAD check.
async function repoInfo(cwd, on) {
  const r = await exec("git", ["rev-parse", "--show-toplevel", "--verify", "--quiet", "HEAD"], { cwd, on });
  return { root: r.stdout.split("\n")[0].trim() || null, hasHead: r.code === 0 };
}

async function defaultBase(root, on) {
  const head = await exec("git", ["rev-parse", "--abbrev-ref", "origin/HEAD"], { cwd: root, on });
  if (head.code === 0 && head.stdout.trim()) return head.stdout.trim();
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    const r = await exec("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: root, on });
    if (r.code === 0) return ref;
  }
  return null;
}

async function branchBase(root, on) {
  const base = await defaultBase(root, on);
  if (!base) throw new Error("No default branch to compare against");
  return { against: (await git(root, on, ["merge-base", "HEAD", base])).trim(), label: `Since ${base}` };
}

// mode "work": uncommitted changes against HEAD; "branch": everything since the
// merge-base with the default branch, uncommitted included. Each git call costs a process
// start, so they all start at once from the opened folder: diff paths are relative to the
// root anyway, ls-files is asked for root-relative names, and HEAD exists in nearly every
// repo, so its diff starts before the check confirms it.
export async function loadDiff(cwd, on, mode) {
  const info = repoInfo(cwd, on);
  const target = info.then(({ root, hasHead }) => {
    if (!root) throw new Error("Not a git repository");
    if (mode === "branch" && hasHead) return branchBase(root, on);
    return { against: hasHead ? "HEAD" : "--cached", label: "Uncommitted" };
  });
  const guess = mode === "work" ? git(cwd, on, ["diff", ...FLAGS, "HEAD"]).catch(() => null) : null;
  const diffed = target.then(async ({ against }) => {
    const guessed = against === "HEAD" && guess ? await guess : null;
    return parse(guessed ?? (await git(cwd, on, ["diff", ...FLAGS, against])));
  });
  // Its failure counts only once target has passed, so outside a repo the root check's error wins.
  const listed = git(cwd, on, ["ls-files", "--others", "--exclude-standard", "-z", "--full-name", "--", ":/"]);
  listed.catch(() => {});
  const untracked = target.then(() => listed).then(async (out) => {
    const fresh = out.split("\0").filter(Boolean).slice(0, MAX_UNTRACKED);
    return { fresh, lines: await lineCounts((await info).root, on, fresh) };
  });
  const [{ root }, { against, label }, files, { fresh, lines }] = await Promise.all([info, target, diffed, untracked]);
  for (const path of fresh) files.push({ path, status: "A", add: lines.get(path) ?? 0, del: 0, rows: null, untracked: true });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root, files, label, against };
}

// New files' line counts in one pass, so the list shows them before each file is opened.
async function lineCounts(root, on, paths) {
  if (!paths.length) return new Map();
  const r = await exec("awk", ['{ n[FILENAME]++ } END { for (f in n) print n[f] "\t" f }', ...paths], { cwd: root, on });
  return new Map(r.stdout.split("\n").filter(Boolean).map((l) => { const tab = l.indexOf("\t"); return [l.slice(tab + 1), +l.slice(0, tab)]; }));
}

// One file's diff with syntax colors and changed words, read when the file is opened.
// Untracked files are first read here too: one huge generated file would stall the list.
export async function loadFile(root, on, file, against, dark, still = () => true) {
  const args = file.untracked ? ["diff", "--no-index", ...FLAGS, "--", "/dev/null", file.path] : ["diff", ...FLAGS, against, "--", file.path];
  const r = await exec("sh", ["-c", DELTA, "sh", dark ? "OneHalfDark" : "GitHub", language(file.path), ...READ, ...args], { cwd: root, on });
  if (!still()) return null;
  const lines = r.stdout.split("\n").slice(0, MAX_ROWS + 100).map(colors);
  const [parsed] = parse(lines.map((l) => l.plain).join("\n"), lines.map((l) => l.spans));
  return parsed ?? { add: 0, del: 0, rows: [{ kind: "", text: (r.stderr || "No text changes").trim() }] };
}

const language = (path) => /\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? "txt";

// SGR runs to spans: { text, fg, emph }. delta only emits 24-bit colors, bold and resets.
function colors(line) {
  const spans = [];
  let fg = null, emph = false, plain = "", last = 0;
  const push = (text) => { if (text) { spans.push({ text, fg, emph }); plain += text; } };
  for (const m of line.matchAll(/\x1b\[([0-9;]*)m/g)) {
    push(line.slice(last, m.index));
    last = m.index + m[0].length;
    const codes = m[1].split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { fg = null; emph = false; }
      else if (c === 39) fg = null;
      else if (c === 49) emph = false;
      else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
        const hex = "#" + codes.slice(i + 2, i + 5).map((n) => n.toString(16).padStart(2, "0")).join("");
        if (c === 38) fg = hex; else emph = hex === PLUS_EMPH || hex === MINUS_EMPH;
        i += 4;
      }
    }
  }
  push(line.slice(last));
  return { plain, spans };
}

// Drops the diff marker from a line's spans.
function body(spans) {
  if (!spans?.length) return null;
  const [first, ...rest] = spans;
  return first.text.length > 1 ? [{ ...first, text: first.text.slice(1) }, ...rest] : rest;
}

function parse(text, spans) {
  const files = [];
  let file = null, old = 0, next = 0;
  text.split("\n").forEach((line, n) => {
    if (line.startsWith("diff --git ")) {
      file = { path: line.replace(/^diff --git a\/(.*) b\/.*$/, "$1"), status: "M", add: 0, del: 0, rows: [], hunks: false };
      files.push(file);
      return;
    }
    if (!file) return;
    if (!file.hunks) {
      if (line.startsWith("new file mode")) file.status = "A";
      else if (line.startsWith("deleted file mode")) file.status = "D";
      else if (line.startsWith("+++ b/")) file.path = line.slice(6);
      else if (line.startsWith("--- a/") && file.status === "D") file.path = line.slice(6);
      else if (line.startsWith("Binary files")) file.rows.push({ kind: "", text: "Binary file changed" });
      if (!line.startsWith("@@")) return;
      file.hunks = true;
    }
    if (file.rows.length >= MAX_ROWS) {
      file.cut = (file.cut ?? 0) + 1;
      if (line[0] === "+") file.add++;
      else if (line[0] === "-") file.del++;
      return;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/.exec(line);
    const s = body(spans?.[n]);
    if (hunk) { old = +hunk[1]; next = +hunk[2]; file.rows.push({ kind: "@", text: hunk[3] ?? "", old, new: next }); }
    else if (line[0] === "+") { file.add++; file.rows.push({ kind: "+", new: next++, text: line.slice(1), spans: s }); }
    else if (line[0] === "-") { file.del++; file.rows.push({ kind: "-", old: old++, text: line.slice(1), spans: s }); }
    else if (line[0] === " ") file.rows.push({ kind: " ", old: old++, new: next++, text: line.slice(1), spans: s });
  });
  for (const f of files) {
    if (f.cut) f.rows.push({ kind: "", text: `… diff cut at ${MAX_ROWS} lines` });
    if (!f.rows.length) f.rows.push({ kind: "", text: "No text changes (mode or permissions)" });
    delete f.hunks; f.cut = Boolean(f.cut);
  }
  return files;
}

// A commentable row: real code lines, not hunk headers or notes.
export const isLine = (row) => row && (row.kind === "+" || row.kind === "-" || row.kind === " ");

export function anchor(rows, from, to) {
  const picked = rows.slice(from, to + 1).filter(isLine);
  const nums = picked.map((r) => r.new ?? r.old);
  const first = nums[0], last = nums[nums.length - 1];
  return { lines: first === last ? `${first}` : `${first}-${last}`, code: picked.map((r) => `${r.kind}${r.text}`).join("\n") };
}

export function message(comments, label) {
  const parts = [`I reviewed the changes (${label.toLowerCase()}). Address each comment below:`];
  comments.forEach((c, i) => {
    parts.push(`${i + 1}. ${c.path}:${c.lines}\n\`\`\`diff\n${c.code}\n\`\`\`\n${c.text}`);
  });
  return parts.join("\n\n");
}
