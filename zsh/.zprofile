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
  $path
)

# Herdr panes are login shells, so FPATH accumulates duplicates when nested.
typeset -U path fpath
