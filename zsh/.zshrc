alias oc='ocv'
alias cc='claude'
alias cx='codex'
alias pn='pnpm'
alias ls='eza --all'
alias ll='eza --all --long'
alias tree='eza --tree'
alias mv='mv -iv'
alias cp='cp -riv'
alias mkdir='mkdir -vp'
alias t='tmux'
alias g='git'
alias lg='lazygit'
alias n='nvim'
alias ts='tailscale'

export DOTFILES="$HOME/dotfiles"

export PATH="$HOME/.local/bin:$PATH"

export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

eval "$(git wt --init zsh)"

bindkey -e

source ~/.config/zsh/tmux.zsh
source ~/.config/zsh/git.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"

[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"
