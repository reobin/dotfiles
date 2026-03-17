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

autoload -Uz up-line-or-search down-line-or-search

bindkey '^[[A' up-line-or-search
bindkey '^[[B' down-line-or-search
bindkey '^[OA' up-line-or-search
bindkey '^[OB' down-line-or-search

if (( ${+terminfo[kcuu1]} )); then
  bindkey "$terminfo[kcuu1]" up-line-or-search
fi

if (( ${+terminfo[kcud1]} )); then
  bindkey "$terminfo[kcud1]" down-line-or-search
fi
