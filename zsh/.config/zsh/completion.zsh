autoload -Uz compinit

setopt GLOB_DOTS

local zcompdump_dir=${XDG_CACHE_HOME:-$HOME/.cache}/zsh
[[ -d $zcompdump_dir ]] || mkdir -p "$zcompdump_dir"

zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'
zstyle ':completion:*' squeeze-slashes true
zstyle ':completion:*' special-dirs false

compinit -d "$zcompdump_dir/zcompdump"
