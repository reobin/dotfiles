---
description: Create a PR from existing commits, creating a branch first if needed.
argument-hint: [optional scope or intent]
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git rev-parse *) Bash(git branch *) Bash(git wt *) Bash(git remote *) Bash(git push *) Bash(gh pr create *) Bash(gh repo view *)
---

<!-- Generated from ai/commands/pr/body.md by ai/commands/pr/sync -->

Create a pull request for the current branch.

Rules:
- Treat invoking `/pr` as authorization to create a PR.
- Determine the repository default branch before drafting the PR.
- If the current branch is the default branch, create a new branch first and use that branch for the PR.
- In dotfiles repositories that must not switch branches in place, create the branch in a separate `git wt` worktree and continue the rest of the flow there.
- When using the dotfiles worktree flow, operate on the new worktree directly rather than checking out another branch in the current directory.
- When creating a new branch from the default branch, choose the branch name yourself.
- Use a conventional, short branch name in most repositories.
- In dotfiles repositories, prefer the form `<context>/stuff`.
- If command arguments are provided, use them as a hint for branch naming when helpful.
- If `/pr` is invoked from the default branch with uncommitted changes, move that work onto the new branch, create the commit there, then create the PR.
- In dotfiles repositories, if `/pr` is invoked from the default branch with uncommitted changes, create the worktree-backed branch first, move the changes there if needed, create the commit there, then create the PR.
- When `/pr` needs to create a commit, follow the existing `/commit` command rules for scoping, staging, message style, and safety.
- If `/pr` is invoked from a non-default branch, only create a PR for commits that already exist on that branch.
- Compare the current branch against the default branch and review all commits that would be included.
- Inspect `git status`, branch tracking state, `git log`, and the diff against the default branch before writing the PR.
- If the current branch has no commits ahead of the default branch, stop and tell me there is nothing to open a PR for.
- If the current branch does not yet exist on the remote, push it with upstream tracking before creating the PR.
- If the current branch already tracks a remote branch but local commits have not been pushed yet, push them before creating the PR.
- Do not create a PR from uncommitted work alone unless `/pr` is handling the required commit as described above.
- Choose the PR title yourself. Do not ask me to write it.
- Keep the PR title short and direct.
- Keep the PR body short and direct.
- Do not include headings like `## Summary` or `## Testing` unless I explicitly ask for them.
- Most of the time, make the PR body a short bullet list covering what changed.
- Include why only when that context is actually helpful.
- If command arguments are provided, use them only as a hint for PR framing.
- After creating a commit as part of `/pr`, do not ask separately whether to push; continue through branch push and PR creation.
- Before creating the PR, show the PR title, body, base branch, and head branch so I can review them.
- After creating the PR, show the PR title, URL, and a summary of what was included (commits, files changed).
- Keep all output text lowercase, except when referring to names that are inherently uppercase (file paths, env vars, branch names, etc.).

PR style:

```text
type: short subject

- short point
- short why
```

If command arguments are provided, use them as PR scope or intent, for example:
- `/pr auth fixes`
- `/pr sync cleanup`
- `/pr only the nix changes`

Do not treat the command arguments as the literal PR title unless I explicitly say so.
