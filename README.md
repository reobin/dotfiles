# dotfiles

My machine setup: software + configs, linked with [GNU Stow](https://www.gnu.org/software/stow/). Fedora/dnf.

- `install.sh` — installs everything. Re-run any time to update.
- `stow/<pkg>/` — config files, mirroring where they link to.

## Use

```bash
./install.sh            # install / update everything
```

`install.sh` is idempotent — keyd's shipped `/etc/keyd/default.conf` is
removed (or backed up to `.bak.<date>` if locally edited) before stowing.

## Add a tool

- System package: add it to the `dnf install` line in `install.sh`.
- Language/runtime tool (`node`, `pi`, …): add it to
  `stow/mise/.config/mise/config.toml` (`mise use -g tool@version`).
  Update with `mise upgrade` (run by `install.sh`).
1. Put its configs in `stow/<pkg>/…`, mirroring the target path:
   `stow/foo/.config/foo/x` → `~/.config/foo/x`;
   `stow/bar/etc/…` → `/etc/…` (link with `sudo stow -t /`, like keyd).
3. Add a block in `install.sh` (stow line, plus service lines if needed).

## Remove a tool

Delete its block + dnf entry (or `mise` entry), run `stow -D -t <target> <pkg>` once
(`sudo` for `/` targets), delete `stow/<pkg>/`.

## Notes

- **keyd**: system-wide config. After editing, `sudo systemctl restart keyd`
  (or just re-run `install.sh`). Verify live with `sudo keyd -m`.
- **nvim**: minimal starter `init.lua`.
- **mise**: `stow/mise/.config/mise/config.toml` → `~/.config/mise/config.toml`.
  Tools: `node = "24"`, `gh`/`pi`/`starship` = `"latest"` (aqua binaries). `mise upgrade`
  updates them; `mise self-update` updates mise itself. `mup`
  (`~/.local/bin/mup`) does both with no minimum release age. Don't use
  `pi update` anymore — it bypasses mise tracking.
- **zsh**: the interactive shell (`install.sh` runs `chsh` to it).
  `~/.zshrc`, `~/.zprofile`, `~/.zshenv`, `~/.config/zsh/`, ported from the
  macos branch. Prompt is **starship**
  (`~/.config/starship.toml`, binary via mise). macOS-only bits are left
  out: `tt` theme-switcher, `fzf-tab` (not packaged on Fedora), brew setup.
- **git**: `~/.config/git/config` (aliases like `ca`, `pf`, `ri`, `bc`, …),
  global `ignore`, `scripts/branch-cleanup` (via `git bc`). Commit
  signing is commented out until `~/.ssh/id_ed25519.pub` exists.
- If stow ever complains a file already exists: back it up, delete it,
  or run that one stow line with `--adopt` once.
