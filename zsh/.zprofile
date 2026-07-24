eval "$(/opt/homebrew/bin/brew shellenv zsh)"

source ~/.config/zsh/path.zsh

pathadd "/opt/homebrew/opt/libpq/bin"
pathadd "$HOME/.local/bin"
pathadd "$HOME/.cargo/bin"
pathadd "$HOME/.opencode/bin"
pathadd "/opt/homebrew/bin"
pathadd "$HOME/bin"
