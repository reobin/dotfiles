---
description: Commit current changes, optionally scoped by an argument like "/commit auth fixes", then ask whether to push.
argument-hint: [optional scope or intent]
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git add -A) Bash(git commit *) Bash(git log *) Bash(git push *) AskUserQuestion
---

<!-- Generated from ai/commands/commit/body.md by ai/commands/commit/sync -->

Create a git commit for the current uncommitted changes.

Rules:
- Treat invoking `/commit` as authorization to commit.
- If no command arguments are provided, commit all current tracked, modified, staged, and untracked changes.
- If I provide command arguments, treat them as a scoping hint for what this commit should cover.
- When command arguments are provided, include only files and hunks that are clearly related to that scope.
- When command arguments are provided, never fall back to `git add -A`.
- When command arguments are provided and the related file set is ambiguous, stop and ask me which files to include instead of guessing.
- When command arguments are provided and unrelated changes exist in the worktree, list the files you intend to commit and ask for confirmation before creating the commit.
- When no command arguments are provided, stage everything with `git add -A`.
- Inspect the worktree with `git status`, `git diff`, and `git diff --cached` before writing the message.
- Review recent commit subjects with `git log` to match local style where it does not conflict with conventional commits.
- If the scope clearly matches only part of the worktree, stage only the relevant changes.
- Before committing, review the staged diff and verify it matches the requested scope exactly.
- Choose the commit message yourself. Do not ask me to write it.
- Follow conventional commits in normal repositories.
- When the current repository is this dotfiles repo, use a context prefix instead of a conventional commit type.
- In this dotfiles repo, format the subject as `context: short subject`.
- Infer `context` from the files being committed or the command argument, and prefer specific areas like `zsh`, `nvim`, `bash`, `git`, `tmux`, `claude`, `opencode`, `ai`, `hypr`, or `waybar` over generic labels.
- If the changes span multiple unrelated areas in this dotfiles repo and no single context fits, stop and ask me which context to use.
- Keep the subject short and direct.
- Keep the body short and direct.
- Prefer no body for simple changes.
- If a body is useful, use short bullet points.
- Explain why only when that context is actually helpful.
- Never add co-author lines.
- Never push automatically.
- Never create an empty commit.
- Do not commit obvious secret files.
- After creating the commit, show a summary that includes: the full commit message, the list of files changed, and a short stat (insertions/deletions). When command arguments were provided and not all changes were committed, also list the files that were left uncommitted. Then use the `AskUserQuestion` tool to ask whether to push, with options like "push now" and "skip push".
- Keep all output text lowercase, except when referring to names that are inherently uppercase (file paths, env vars, branch names, etc.).

Message style:

```text
type: short subject

- short point
- short why
```

Dotfiles repo style:

```text
context: short subject

- short point
- short why
```

If command arguments are provided, use them as commit scope or intent, for example:
- `/commit auth fixes`
- `/commit stuff related to syncing`
- `/commit only the synthinc changes`

Do not treat the command arguments as the literal commit message unless I explicitly say so.
