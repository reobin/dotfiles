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

# python
export PATH="/opt/homebrew/opt/python/libexec/bin:$PATH"

# rust
export PATH="$HOME/.cargo/bin:$PATH"

# plugins
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh

# eza
alias ls="eza"
alias ll="eza --long"
alias tree="eza --tree"

# zoxide
eval "$(zoxide init zsh)"
alias cd="z"

# prompt
fpath=($fpath "$HOME/.zfunctions")
export TYPEWRITTEN_RELATIVE_PATH="home"
export TYPEWRITTEN_PROMPT_LAYOUT="pure"
autoload -U promptinit; promptinit
prompt typewritten

source $ZSH/oh-my-zsh.sh
