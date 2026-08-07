# Must run after compinit, since `fzf --zsh` ships completions that call compdef.
zsh_cached_eval fzf fzf --zsh

export FZF_DEFAULT_OPTS='--height=40% --layout=reverse --cycle --info=inline'

export FZF_CTRL_R_OPTS='--no-sort'

# fzf walks the tree itself when FZF_DEFAULT_COMMAND is unset, and its default
# --walker-skip already drops .git and node_modules, so there is no `fd` here.
export FZF_ALT_C_OPTS='--preview="eza --tree --level=2 --color=always {}"'
