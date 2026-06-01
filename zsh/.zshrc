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
alias h='herdr'
alias g='git'
alias lg='lazygit'
alias n='nvim'
alias ts='tailscale'

export DOTFILES="$HOME/dotfiles"

export BUN_INSTALL="$HOME/.bun"
export PNPM_HOME="/Users/reobin/Library/pnpm"

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

source ~/.config/zsh/path.zsh

pathadd "$HOME/.local/bin"
pathadd "$BUN_INSTALL/bin"
pathadd "$PNPM_HOME"
pathadd "$PNPM_HOME/bin"

eval "$(git wt --init zsh)"

bindkey -e

source ~/.config/zsh/tmux.zsh
source ~/.config/zsh/herdr.zsh
source ~/.config/zsh/hammerspoon.zsh
source ~/.config/zsh/git.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh
source ~/.config/zsh/herdr.zsh

eval "$(starship init zsh)"
eval "$(zoxide init zsh --cmd cd)"

[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

[ -f "/Users/reobin/.openclaw/completions/openclaw.zsh" ] && source "/Users/reobin/.openclaw/completions/openclaw.zsh"
