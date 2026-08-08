source ~/.config/zsh/cache.zsh

zsh_cached_eval brew /opt/homebrew/bin/brew shellenv zsh

source ~/.config/zsh/path.zsh

pathadd "$HOME/.local/bin"
pathadd "$HOME/.cargo/bin"
pathadd "/opt/homebrew/bin"
pathadd "$HOME/bin"

# Herdr panes are login shells, so FPATH accumulates duplicates when nested.
typeset -U path fpath
