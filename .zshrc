export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="theunraveler"

plugins=(
  git
)

source $ZSH/oh-my-zsh.sh

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
source $(brew --prefix nvm)/nvm.sh

## python
alias python="/usr/local/bin/python3"

## Fix cursor when exiting vim
_fix_cursor() {
   echo -ne '\e[3 q'
}
precmd_functions+=(_fix_cursor)

