alias oc='ocv'
alias cc='claude'
alias co='codex'
alias pn='pnpm'
alias pnx='pnpm dlx'
alias ls='eza --all'
alias ll='eza --all --long'
alias tree='eza --tree'
alias mv='mv -iv'
alias cp='cp -riv'
alias mkdir='mkdir -vp'
alias h='herdr'
alias g='git'
alias lg='lazygit'
alias n='nvim'
alias ts='tailscale'

export DOTFILES="$HOME/dotfiles"

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

eval "$(git wt --init zsh)"

bindkey -e

source ~/.config/zsh/git.zsh
source ~/.config/zsh/aws.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh
source ~/.config/zsh/theme.zsh

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"

eval "$(mise activate zsh)"
