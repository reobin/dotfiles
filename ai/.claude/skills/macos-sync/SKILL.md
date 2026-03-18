---
name: macos-sync
description: >
  Use when on the macos branch and the user wants to review commits from main
  and selectively cherry-pick them. Triggers: "macos-sync", "sync from main",
  "review main commits", "pick commits from main", "what's new on main",
  "cherry-pick from main".
---

# macos-sync Skill

Interactive workflow to review commits on `main` not yet on `macos`, then
cherry-pick, skip, or permanently ignore them one at a time.

## Prerequisites (verify before starting)

1. Current branch must be `macos`. Stop and warn if not.
2. Working tree must be clean. Stop and ask to stash/commit if not.
3. Fetch to ensure origin/main is current: `git fetch origin main`

## Skill File Locations

Relative to repo root (`git rev-parse --show-toplevel`):
- Skipped SHAs file: `ai/.claude/skills/macos-sync/skipped-shas`

## Step 1: Build the Unreviewed Commit List

```bash
git log --reverse --oneline origin/main ^HEAD
```

Load skipped SHAs (one full SHA per line, ignore everything after `#`):

```bash
cat ai/.claude/skills/macos-sync/skipped-shas 2>/dev/null
```

Filter out skipped SHAs. Report: `Found N unreviewed commits (X skipped permanently).`

If list is empty, say so and stop.

## Step 2: Review Each Commit (oldest first)

For each commit show:
- `--- Commit M of N ---` header with SHA, message, author, date
- `git show --stat <sha>` — file summary
- `git show <sha>` — full diff

Then prompt:
```
[c] cherry-pick   — apply this commit
[s] skip          — skip now, show again next session
[n] never         — skip permanently (record in skipped-shas)
[q] quit          — stop, continue later
```

**c — cherry-pick:**
Run `git cherry-pick <sha>`. On conflict: show status/diff, ask user to resolve
then confirm, or type 'abort' to run `git cherry-pick --abort`.

**s — skip:**
Move to next commit. It reappears next session.

**n — never:**
Append to `ai/.claude/skills/macos-sync/skipped-shas`:
```
<full_sha>  # <commit subject>
```
Immediately commit:
```bash
git add ai/.claude/skills/macos-sync/skipped-shas
git commit -m "macos-sync: Skip <sha_short> (<subject>)"
```

**q — quit:**
Print session summary (cherry-picked / skipped / permanently skipped / remaining) and stop.

## After All Commits Reviewed

Print final session summary.

## Safety Rules

- NEVER run `git merge`, `git rebase`, or `git reset`
- NEVER push unless user explicitly requests it
- NEVER cherry-pick multiple commits at once — always one at a time with confirmation
- Always confirm you are on `macos` before any write operation
