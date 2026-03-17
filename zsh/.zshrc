alias c='opencode'

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

source ~/.config/zsh/tmux.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"
