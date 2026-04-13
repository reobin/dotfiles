Create a pull request for the current branch.

Rules:
- Treat invoking `/pr` as authorization to create a PR.
- Only create a PR for commits that already exist on the current branch.
- Never create a PR from the default branch.
- Determine the repository default branch before drafting the PR.
- Compare the current branch against the default branch and review all commits that would be included.
- Inspect `git status`, branch tracking state, `git log`, and the diff against the default branch before writing the PR.
- If the current branch has no commits ahead of the default branch, stop and tell me there is nothing to open a PR for.
- If the current branch does not yet exist on the remote, push it with upstream tracking before creating the PR.
- If the current branch already tracks a remote branch but local commits have not been pushed yet, push them before creating the PR.
- Do not create a PR from uncommitted or unpushed work alone.
- Choose the PR title yourself. Do not ask me to write it.
- Keep the PR title short and direct.
- Keep the PR body short and direct.
- Do not include headings like `## Summary` or `## Testing` unless I explicitly ask for them.
- Most of the time, make the PR body a short bullet list covering what changed.
- Include why only when that context is actually helpful.
- If command arguments are provided, use them only as a hint for PR framing.
- Return the PR URL after creation.

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
