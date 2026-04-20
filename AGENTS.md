# Agent Instructions

When working on this macOS dotfiles repository:

- Make changes directly to files in this repo
- Do NOT modify system files outside this repo (for example `~/.zshrc` or `~/.config/ghostty/config`)
- Dotfiles are linked into place from this repo via `stow` scripts under `macos/dotfiles/`
- When the user asks to install, configure, enable, or add a tool, treat that as a request to make the change reproducible in this repo first, not as a one-off system mutation.
- Prefer adding or updating repo-managed install scripts, Brewfile entries, stow-managed config, or init/bootstrap logic so the change is applied via `./macos/init`.
- Only perform direct machine-local installation outside the repo if the user explicitly asks for a one-off/manual install or if repo automation is not feasible.
- Default assumption: if it can live in this repo, it should.
- Commit style in this repo is context-first, not conventional commits. Do not use prefixes like `feat:`, `fix:`, or `chore:`.
- Write commit subjects as `<context>: <short subject>`, where the context is the main area changed, for example `macos: ...`, `brew: ...`, `zsh: ...`, `ghostty: ...`, or `aerospace: ...`.
- When a change touches multiple areas, choose the context for the primary user-facing impact rather than the largest diff.
- **Never auto-commit changes** — only commit when explicitly requested.
- **No co-author** — do not add Co-Authored-By lines to commit messages.
- **Never checkout other branches** — dotfiles are symlinked, so switching branches breaks the system config. Use `git wt` to work on other branches in a separate directory.
