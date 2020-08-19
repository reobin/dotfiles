#
#  ███████╗███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ 
#  ╚══███╔╝██╔════╝██║  ██║    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ 
#    ███╔╝ ███████╗███████║    ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
#   ███╔╝  ╚════██║██╔══██║    ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
#  ███████╗███████║██║  ██║    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
#  ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝ 
#

ZSH="$HOME/.oh-my-zsh"

export VISUAL="nvim"
export EDITOR="nvim"

# prompt
fpath+=$HOME/.zsh/typewritten
autoload -U promptinit; promptinit
prompt typewritten

# plugins
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh

# Open in sublime merge
alias smerge="open -a \"Sublime Merge\""
alias typo="open -a \"Typora\""

# Use brew python
alias python=/usr/local/bin/python3
alias pip="python -m pip"

## Fixes fzf searching in git ignored files and folders
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -g ""'
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

source $ZSH/oh-my-zsh.sh
