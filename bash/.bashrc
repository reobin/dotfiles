[[ $- != *i* ]] && return
# If not running interactively, don't do anything (leave this at the top of this file)

# All the default Omarchy aliases and functions
# (don't mess with these directly, just overwrite them here!)
source ~/.local/share/omarchy/default/bash/rc

eval "$(git wt --init bash)"

alias ls="eza --all"
alias ll="eza --all --long"
alias tree="eza --tree"

alias mv="mv -iv"           # interactive verbose
alias cp="cp -riv"          # recursive interactive verbose
alias mkdir="mkdir -vp"     # verbose parent

source "$HOME/.config/bash/vpn.sh"
