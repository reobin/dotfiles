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
  Tools: `node = "24"`, `pi = "latest"` (aqua binary). `mise upgrade`
  updates them; `mise self-update` updates mise itself. `mup`
  (`~/.local/bin/mup`) does both with no minimum release age. Don't use
  `pi update` anymore — it bypasses mise tracking.
- **bash**: snippets in `~/.bashrc.d/`, not a full-`.bashrc` takeover.
- If stow ever complains a file already exists: back it up, delete it,
  or run that one stow line with `--adopt` once.
