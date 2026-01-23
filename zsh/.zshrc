eval "$(starship init zsh)"
eval "$(zoxide init zsh)"

export EDITOR="nvim"
export SUDO_EDITOR="$EDITOR"

bindkey -e # disable vim mode on shell

HISTFILE=$HOME/.zsh_history
HISTSIZE=10000
SAVEHIST=10000

setopt hist_ignore_dups      # ignore immediate duplicates
setopt hist_ignore_all_dups  # remove older duplicates
setopt hist_find_no_dups     # skip duplicates when searching
setopt inc_append_history    # write history immediately
setopt globdots              # include dotfiles in completion results

autoload -Uz compinit
compinit

source <(fzf --zsh)

alias cd="z"

alias ls="eza"
alias ll="eza --long"
alias tree="eza --tree"

alias mv="mv -iv" # interactive verbose
alias cp="cp -riv" # recursive interactive verbose
alias mkdir="mkdir -vp" # verbose parent

bindkey '^[[A' history-beginning-search-backward
bindkey '^[[B' history-beginning-search-forward
