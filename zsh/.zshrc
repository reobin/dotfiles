#
#  ███████╗███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ 
#  ╚══███╔╝██╔════╝██║  ██║    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ 
#    ███╔╝ ███████╗███████║    ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
#   ███╔╝  ╚════██║██╔══██║    ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
#  ███████╗███████║██║  ██║    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
#  ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝ 
#

ZSH="$HOME/.oh-my-zsh"

export TERM=xterm-256color

export VISUAL="vim"
export EDITOR="vim"

# prompt
autoload -U promptinit; promptinit
prompt typewritten

# plugins
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh

# Open in sublime merge
alias smerge="open -a \"Sublime Merge\""
alias typo="open -a \"Typora\""

# Go back to git root
go_to_root() {
  root="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ ! -z $root ]; then
    cd "$root"
  fi;
}
alias gtr=go_to_root

# python -> python3
alias python=python3
alias pip3="python -m pip"
alias pip=pip3

# Fixes fzf searching in git ignored files and folders
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -g ""'
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

source $ZSH/oh-my-zsh.sh
