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
export GH_PAGER="cat"

# Base commands
alias mv="mv -iv" # interactive, verbose
alias cp="cp -riv" # recursive, interactive, verbose
alias mkdir="mkdir -vp" # verbose, parent

# nvm
source $(brew --prefix nvm)/nvm.sh

# ruby
export PATH="$HOME/.rbenv/bin:$PATH"

# plugins
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh

# prompt
fpath=($fpath "$HOME/.zfunctions")
export TYPEWRITTEN_RELATIVE_PATH="home"
export TYPEWRITTEN_PROMPT_LAYOUT="pure"
autoload -U promptinit; promptinit
prompt typewritten

source $ZSH/oh-my-zsh.sh
