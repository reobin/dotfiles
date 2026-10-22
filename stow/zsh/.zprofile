source ~/.config/zsh/cache.zsh

# No path_helper dance here like on macOS: Fedora login shells inherit a sane
# PATH, so just make sure the local bins and mise shims come first. `mise
# activate` in .zshrc replaces the shims with the real install dirs.
path=(
  $HOME/bin(N-/)
  $HOME/.local/share/mise/shims(N-/)
  $HOME/.cargo/bin(N-/)
  $HOME/.local/bin(N-/)
  $path
)

typeset -U path fpath
