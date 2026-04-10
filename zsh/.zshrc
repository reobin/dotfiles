alias oc='opencode'
alias cc='claude'
alias cx='claude --dangerously-skip-permissions'
alias ls='eza --all'
alias ll='eza --all --long'
alias tree='eza --tree'
alias mv='mv -iv'
alias cp='cp -riv'
alias mkdir='mkdir -vp'
alias t='tmux'
alias g='git'
alias lg='lazygit'

export PATH="$HOME/.local/bin:$PATH"

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

eval "$(git wt --init zsh)"

bindkey -e

source ~/.config/zsh/tmux.zsh
source ~/.config/zsh/worktrees.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"
