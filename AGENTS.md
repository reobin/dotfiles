# Agent Instructions

When working on this macOS dotfiles repository:

- Make changes directly to files in this repo
- Do NOT modify system files outside this repo (for example `~/.zshrc` or `~/.config/ghostty/config`)
- Dotfiles are linked into place from this repo via `stow` scripts under `macos/dotfiles/`
- **Never auto-commit changes** — only commit when explicitly requested.
- **No co-author** — do not add Co-Authored-By lines to commit messages.
- **Never checkout other branches** — dotfiles are symlinked, so switching branches breaks the system config. Use `git wt` to work on other branches in a separate directory.
