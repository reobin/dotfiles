# Agent Instructions

When working on this Fedora dotfiles repository:

- Make changes directly to files in this repo
- Do NOT modify system files outside this repo (for example `~/.bashrc`, `~/.config/ghostty/config`, or `/etc/keyd/default.conf`)
- Configs live in `stow/<pkg>/`, mirroring their target paths, and link into place via `./install.sh` (`stow -d stow -R -t $HOME <pkg>`, `sudo stow -t /` for system targets like keyd)
- `install.sh` is idempotent — re-run it to apply/update everything
- When the user asks to install, configure, enable, or add a tool, treat that as a request to make the change reproducible in this repo first, not as a one-off system mutation
- Prefer updating the `dnf install` line, `stow/mise/.config/mise/config.toml`, stow-managed config, or `install.sh` logic so the change is applied via `./install.sh`
- Only perform direct machine-local installation outside the repo if the user explicitly asks for a one-off/manual install or if repo automation is not feasible
- Default assumption: if it can live in this repo, it should
- Commit style in this repo is context-first, not conventional commits. Do not use prefixes like `feat:`, `fix:`, or `chore:`
- Write commit subjects as `<context>: <short subject>`, where the context is the main area changed, for example `install: ...`, `bash: ...`, `ghostty: ...`, `nvim: ...`, `mise: ...`, `keyd: ...`, `tmux: ...`, or `git: ...`
- When a change touches multiple areas, choose the context for the primary user-facing impact rather than the largest diff
- **Never checkout other branches** — dotfiles are symlinked, so switching branches breaks the system config. Use `git worktree` to work on other branches in a separate directory
- **Never leave a branch behind when committing and pushing** — if committing to another branch or worktree, fetch first and rebase or otherwise bring it up to date before pushing
