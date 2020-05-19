#
#  ███████╗███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ 
#  ╚══███╔╝██╔════╝██║  ██║    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ 
#    ███╔╝ ███████╗███████║    ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
#   ███╔╝  ╚════██║██╔══██║    ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
#  ███████╗███████║██║  ██║    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
#  ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝ 
#

export ZSH="$HOME/.oh-my-zsh"

export VISUAL="nvim"

ZSH_THEME="typewritten"

plugins=(
  git
)

export MAILCHECK=0

## Vim
alias vim=/usr/local/bin/vim

## git 
export REVIEW_BASE="master"

## Ruby
export PATH=$HOME/.gem/ruby/2.6.0/bin:$PATH
export PATH=/usr/local/opt/ruby/bin:$PATH

## Open in sublime merge
alias smerge="open -a \"Sublime Merge\""

## NVM
export NVM_DIR=~/.nvm
#source $(brew --prefix nvm)/nvm.sh

## python
#alias python="/usr/local/bin/python3"

## Fixes fzf searching in git ignored files and folders
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -g ""'

export TYPEWRITTEN_CURSOR="underscore"
export TYPEWRITTEN_PROMPT_LAYOUT="singleline"
export TYPEWRITTEN_SYMBOL=">"
export TYPEWRITTEN_GIT_RELATIVE_PATH=true

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

source $ZSH/oh-my-zsh.sh
