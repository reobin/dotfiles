HISTFILE=${ZDOTDIR:-$HOME}/.zsh_history
HISTSIZE=100000
SAVEHIST=100000

setopt APPEND_HISTORY
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_SAVE_NO_DUPS
setopt HIST_VERIFY
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY

autoload -Uz up-line-or-beginning-search down-line-or-beginning-search edit-command-line

zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
zle -N edit-command-line

bindkey '^[[A' up-line-or-beginning-search
bindkey '^[[B' down-line-or-beginning-search
bindkey '^[OA' up-line-or-beginning-search
bindkey '^[OB' down-line-or-beginning-search
bindkey '^X' edit-command-line

if (( ${+terminfo[kcuu1]} )); then
  bindkey "$terminfo[kcuu1]" up-line-or-beginning-search
fi

if (( ${+terminfo[kcud1]} )); then
  bindkey "$terminfo[kcud1]" down-line-or-beginning-search
fi
