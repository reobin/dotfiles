eval "$(starship init zsh)"
eval "$(zoxide init zsh)"

export EDITOR="nvim"
export SUDO_EDITOR="$EDITOR"

source <(fzf --zsh)

alias cd="z"
