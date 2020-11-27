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

export VISUAL="nvim"
export EDITOR="nvim"

export PAGER="less"
export GLAB_PAGER="cat"
export GH_PAGER="cat"

alias glab="PAGER=cat glab"

export TYPEWRITTEN_PROMPT_LAYOUT="pure"

# prompt
autoload -U promptinit; promptinit
prompt typewritten

# plugins
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh

# Base commands
alias mv="mv -iv" # interactive, verbose
alias cp="cp -riv" # recursive, interactive, verbose
alias mkdir="mkdir -vp" # verbose, parent

# Open in sublime merge
alias smerge="open -a \"Sublime Merge\""
alias typo="open -a \"Typora\""

alias grt='cd "$(git rev-parse --show-toplevel || echo .)"'

# Use like so: prettyjson ugly.json > pretty.json
alias prettyjson="python -m json.tool"

# python -> python3
alias python=python3
alias pip3="python -m pip"
alias pip=pip3

# go
export GOPATH=$HOME/go
export GOBIN=$GOPATH/bin

# Fixes fzf searching in git ignored files and folders
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -g ""'
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

source $ZSH/oh-my-zsh.sh

export PATH="$HOME/.rbenv/bin:$PATH"
eval "$(rbenv init -)"
