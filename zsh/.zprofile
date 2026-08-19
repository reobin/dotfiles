source ~/.config/zsh/cache.zsh

zsh_cached_eval brew /opt/homebrew/bin/brew shellenv zsh

# /etc/zprofile runs path_helper on every login shell, hoisting /etc/paths above
# whatever was inherited, so nested login shells (Herdr panes) need these
# prepended again rather than once per process tree.
path=(
  $HOME/bin(N-/)
  /opt/homebrew/bin(N-/)
  $HOME/.opencode/bin(N-/)
  $HOME/.cargo/bin(N-/)
  $HOME/.local/bin(N-/)
  /opt/homebrew/opt/libpq/bin(N-/)
  # Fallback only: `mise activate` prepends the real install dirs in .zshrc, so
  # these shims are last and cover login shells that never reach it. Only login
  # shells read this file at all, so GUI apps and non-interactive shells still see
  # no mise; that would need a .zshenv, which does not exist yet.
  $HOME/.local/share/mise/shims(N-/)
  $path
)

# Herdr panes are login shells, so FPATH accumulates duplicates when nested.
typeset -U path fpath
