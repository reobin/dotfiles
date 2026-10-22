#!/usr/bin/env bash
#
# ~/dotfiles/install.sh — install software and link configs.
# Idempotent: re-run any time to update this machine.
#
# Adding a tool: system package -> add to the dnf line; language/runtime
# tool (node, pi, ...) -> add to stow/mise/.config/mise/config.toml
# (`mise use -g tool@version`). Put its configs in stow/<pkg>/ mirroring
# the target path, and add a stow line in its own block below. Removing: delete those lines, run
# `stow -D -t <target> <pkg>` once (sudo for /), delete stow/<pkg>/.
#
set -euo pipefail
DOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1password: official repo (desktop app + CLI) ---
# NOTE: the 1password package manages /etc/yum.repos.d/1password.repo itself
# (it comments out repo_gpgcheck). Only create it if missing so dnf can
# find the packages on first run; afterwards the package owns updates.
if [ ! -f /etc/yum.repos.d/1password.repo ]; then
  sudo rpm --import https://downloads.1password.com/linux/keys/1password.asc
  sudo tee /etc/yum.repos.d/1password.repo > /dev/null <<'EOF'
[1password]
name=1Password Stable Channel
baseurl=https://downloads.1password.com/linux/rpm/stable/$basearch
enabled=1
gpgcheck=1
gpgkey=https://downloads.1password.com/linux/keys/1password.asc
EOF
fi

# --- ghostty: stable COPR (not in Fedora repos) ---
# scottames/ghostty tracks upstream releases. Guarded so re-runs don't hit the network.
if ! ls /etc/yum.repos.d/*scottames*ghostty*.repo >/dev/null 2>&1; then
  sudo dnf copr enable -y scottames/ghostty
fi

# --- software (re-running upgrades what's already installed) ---
sudo dnf install -y stow keyd neovim tmux git ghostty ripgrep fd-find gcc make 1password 1password-cli zsh eza fzf zoxide zsh-autosuggestions

# --- mise: version manager for node, pi, etc. ---
export PATH="$HOME/.local/bin:$PATH"
if ! command -v mise >/dev/null 2>&1; then
  curl https://mise.run | sh
fi
stow -d "$DOT/stow" -R -t "$HOME" mise
mise self-update
mise upgrade

# --- zsh: the interactive shell ---
# Ports the macos branch setup (starship prompt via mise). Stow first so the
# chsh target exists; legacy ~/.zshrc would be overwritten by stow, so back
# it up once if present (same treatment as ~/.gitconfig above).
for _zshrc in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv"; do
  if [ -e "$_zshrc" ] && [ ! -L "$_zshrc" ]; then
    _bak="$_zshrc.bak.$(date +%F-%H%M%S)"
    echo "zsh: moving legacy $_zshrc aside to $_bak"
    mv "$_zshrc" "$_bak"
  fi
done
unset _zshrc _bak
stow -d "$DOT/stow" -R -t "$HOME" zsh
if [ "$SHELL" != "$(command -v zsh)" ]; then
  echo "zsh: setting default shell (needs password)"
  chsh -s "$(command -v zsh)"
fi

# --- starship: prompt -> ~/.config/starship.toml (binary via mise) ---
stow -d "$DOT/stow" -R -t "$HOME" starship

# --- git: config -> ~/.config/git/ (aliases, defaults, global ignore) ---
# Git reads ~/.config/git/config natively. A legacy ~/.gitconfig would
# override it, so back it up once if present (kept, just moved aside).
if [ -e "$HOME/.gitconfig" ] && [ ! -L "$HOME/.gitconfig" ]; then
  bak="$HOME/.gitconfig.bak.$(date +%F-%H%M%S)"
  echo "git: moving legacy ~/.gitconfig aside to $bak (repo config takes over)"
  mv "$HOME/.gitconfig" "$bak"
fi
stow -d "$DOT/stow" -R -t "$HOME" git

# --- nvim: config -> ~/.config/nvim/init.lua ---
stow -d "$DOT/stow" -R -t "$HOME" nvim

# --- tmux: config -> ~/.tmux.conf ---
stow -d "$DOT/stow" -R -t "$HOME" tmux

# --- ghostty: config -> ~/.config/ghostty/config ---
stow -d "$DOT/stow" -R -t "$HOME" ghostty

# --- keyd: system-wide config -> /etc/keyd/default.conf ---
# stow refuses to overwrite a real file, and keyd ships a default one.
# Handle it so re-runs are clean: identical -> remove, diverged -> back up.
if [ -e /etc/keyd/default.conf ] && [ ! -L /etc/keyd/default.conf ]; then
  if cmp -s /etc/keyd/default.conf "$DOT/stow/keyd/etc/keyd/default.conf"; then
    sudo rm /etc/keyd/default.conf
  else
    bak="/etc/keyd/default.conf.bak.$(date +%F-%H%M%S)"
    echo "keyd: $bak preserving local edits (diff against repo version):"
    diff -u "$DOT/stow/keyd/etc/keyd/default.conf" /etc/keyd/default.conf || true
    sudo cp /etc/keyd/default.conf "$bak"
    sudo rm /etc/keyd/default.conf
    echo "keyd: backed up to $bak"
  fi
fi
sudo stow -d "$DOT/stow" -R -t / keyd
sudo systemctl enable --now keyd
sudo systemctl restart keyd  # apply config changes on re-runs
