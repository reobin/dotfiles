alias c='opencode'
alias ls='eza --all'
alias ll='eza --all --long'
alias tree='eza --tree'
alias mv='mv -iv'
alias cp='cp -riv'
alias mkdir='mkdir -vp'

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

source ~/.config/zsh/tmux.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh

bindkey -e

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"
