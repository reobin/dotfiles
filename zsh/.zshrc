#
#  ███████╗███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ 
#  ╚══███╔╝██╔════╝██║  ██║    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ 
#    ███╔╝ ███████╗███████║    ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
#   ███╔╝  ╚════██║██╔══██║    ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
#  ███████╗███████║██║  ██║    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
#  ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝ 
#

ANTIBODY_HOME="$(antibody home)"

ZSH_THEME=""
plugins=()

export ZSH="$ANTIBODY_HOME/https-COLON--SLASH--SLASH-github.com-SLASH-ohmyzsh-SLASH-ohmyzsh/"

export VISUAL="nvim"

export MAILCHECK=0

## Open in sublime merge
alias smerge="open -a \"Sublime Merge\""

## Fixes fzf searching in git ignored files and folders
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -g ""'
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

export TYPEWRITTEN_CURSOR="underscore"
export TYPEWRITTEN_PROMPT_LAYOUT="singleline"
export TYPEWRITTEN_SYMBOL=">"
export TYPEWRITTEN_GIT_RELATIVE_PATH=true

## Antibody
alias antibody_compile="antibody bundle < ~/dotfiles/zsh/plugins.txt > ~/dotfiles/zsh/plugins.sh"
source ~/dotfiles/zsh/plugins.sh
