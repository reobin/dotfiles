# Agent Instructions

When working on this dotfiles repository:

- Make changes directly to files in this repo
- Do NOT modify system files outside this repo (e.g., `~/.config/waybar/`)
- Symlinks are in place to sync changes to the system
- When the user asks to install, configure, enable, or add a tool, treat that as a request to make the change reproducible in this repo first, not as a one-off system mutation.
- Prefer adding or updating repo-managed install scripts, package lists, symlinked config, or init/bootstrap logic so the change is applied by this repo's setup flow.
- Only perform direct machine-local installation outside the repo if the user explicitly asks for a one-off/manual install or if repo automation is not feasible.
- Default assumption: if it can live in this repo, it should.
- **Never auto-commit changes** — only commit when explicitly requested.
- **No co-author** — do not add Co-Authored-By lines to commit messages.
- **Never checkout other branches** — dotfiles are symlinked, so switching branches breaks the system config. Use `git wt` to work on other branches in a separate directory.
