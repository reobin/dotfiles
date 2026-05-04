[[ $- != *i* ]] && return
# if not running interactively, leave this at the top of this file

# default Omarchy aliases and functions
source ~/.local/share/omarchy/default/bash/rc

export DOTFILES="$HOME/dotfiles"

bind "set match-hidden-files on"

eval "$(git wt --init bash)"

alias ls="eza --all"
alias ll="eza --all --long"
alias tree="eza --tree"

alias mv="mv -iv"       # interactive verbose
alias cp="cp -riv"      # recursive interactive verbose
alias mkdir="mkdir -vp" # verbose parent

unalias c
alias cc="claude"
alias oc='mise x node@25.9.0 -- ocv'
alias cx="codex"
alias pn="pnpm"
alias t="tmux"
alias g="git"
alias lg="lazygit"
alias n="nvim"
alias ts="tailscale"

source "$HOME/.config/bash/vpn.sh"
source "$HOME/.config/bash/cursor.sh"
source "$HOME/.config/bash/tmux.sh"
source "$HOME/.config/bash/tw.sh"
source "$HOME/.config/bash/keybindings.sh"
source "$HOME/.config/bash/git.sh"
source "$HOME/.config/bash/open.sh"
source "$HOME/.config/bash/trash.sh"
source "$HOME/.config/bash/aws.sh"
source "$HOME/.config/bash/path.sh"
source "$HOME/.config/bash/history.sh"

path_prepend "$HOME/.local/bin"
path_append "$HOME/.turso"
path_prepend "$HOME/.opencode/bin"

export PNPM_HOME="/home/reobin/.local/share/pnpm"
path_prepend "$PNPM_HOME"

export BUN_INSTALL="$HOME/.bun"
path_prepend "$BUN_INSTALL/bin"
