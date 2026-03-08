[[ $- != *i* ]] && return
# if not running interactively, leave this at the top of this file

# default Omarchy aliases and functions
source ~/.local/share/omarchy/default/bash/rc

bind "set match-hidden-files on"

eval "$(git wt --init bash)"

alias ls="eza --all"
alias ll="eza --all --long"
alias tree="eza --tree"

alias mv="mv -iv"           # interactive verbose
alias cp="cp -riv"          # recursive interactive verbose
alias mkdir="mkdir -vp"     # verbose parent

source "$HOME/.config/bash/vpn.sh"
source "$HOME/.config/bash/cursor.sh"
source "$HOME/.config/bash/tmux.sh"
source "$HOME/.config/bash/keybindings.sh"
source "$HOME/.config/bash/worktrees.sh"
export PATH="$HOME/.local/bin:$PATH"
