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

export DOTFILES="$HOME/dotfiles"

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

source ~/.config/zsh/cache.zsh

zsh_cached_eval git-wt git-wt --init zsh

bindkey -e

source ~/.config/zsh/git.zsh
source ~/.config/zsh/aws.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh
source ~/.config/zsh/fzf.zsh
source ~/.config/zsh/theme.zsh

zsh_cached_eval starship starship init zsh
# starship always sets RPROMPT, but no right_format is configured, so it spawns
# a second starship per prompt just to print nothing. Drop this line if one is.
RPROMPT=''

zsh_cached_eval zoxide zoxide init zsh --cmd cd

# Not cacheable: `mise activate` bakes the activation-time PATH into its output.
eval "$(mise activate zsh)"

# Last: both plugins wrap the ZLE widgets that exist when they load.
source ~/.config/zsh/plugins.zsh
