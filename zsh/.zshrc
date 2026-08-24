alias oc='ocv'
alias cc='claude'
alias co='codex'
alias pn='pnpm'
alias pnx='pnpm dlx'
alias mup='MISE_MINIMUM_RELEASE_AGE=0 mise up'
alias ls='eza --all'
alias ll='eza --all --long'
alias tree='eza --tree'
alias mv='mv -iv'
alias cp='cp -riv'
alias mkdir='mkdir -vp'
alias h='herdr'
alias g='git'
alias lg='lazygit'
alias d='hunk diff --watch'
alias n='nvim'
alias db='nvim -c DBUI'

export DOTFILES="$HOME/dotfiles"

# Corepack asks for confirmation before downloading a pinned package manager,
# and that prompt blocks forever in a shell with no tty.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

export EDITOR='nvim'
export VISUAL='nvim'
export GIT_EDITOR='nvim'

source ~/.config/zsh/cache.zsh

bindkey -e

source ~/.config/zsh/git.zsh
source ~/.config/zsh/aws.zsh
source ~/.config/zsh/cursor.zsh
source ~/.config/zsh/history.zsh
source ~/.config/zsh/completion.zsh
source ~/.config/zsh/fzf.zsh
source ~/.config/zsh/theme.zsh
source ~/.config/zsh/herdr.zsh

zsh_cached_eval starship starship init zsh
# starship always sets RPROMPT, but no right_format is configured, so it spawns
# a second starship per prompt just to print nothing. Drop this line if one is.
RPROMPT=''

zsh_cached_eval zoxide zoxide init zsh --cmd cd

# Not cacheable: `mise activate` bakes the activation-time PATH into its output.
eval "$(mise activate zsh)"

# After `mise activate`, so zsh_cached_eval keys the cache on the versioned
# binary. Before it, git-wt resolves to a shim whose mtime never changes, so
# an upgrade would keep sourcing the previous version's init.
zsh_cached_eval git-wt git-wt --init zsh

# Last: autosuggestions wraps the ZLE widgets that exist when it loads.
source ~/.config/zsh/plugins.zsh
