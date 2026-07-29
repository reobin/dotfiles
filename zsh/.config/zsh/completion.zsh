autoload -Uz compinit

setopt GLOB_DOTS

local zcompdump_dir=${XDG_CACHE_HOME:-$HOME/.cache}/zsh
[[ -d $zcompdump_dir ]] || mkdir -p "$zcompdump_dir"

zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'
zstyle ':completion:*' squeeze-slashes true
zstyle ':completion:*' special-dirs false

compinit -d "$zcompdump_dir/zcompdump"

# Compile the dump so later startups load bytecode instead of reparsing 50k of
# script. oh-my-zsh does this too, but with an unconditional `zrecompile` that
# costs ~7ms even as a no-op; guarding on mtime keeps the win.
if [[ ! -f $zcompdump_dir/zcompdump.zwc
   || $zcompdump_dir/zcompdump -nt $zcompdump_dir/zcompdump.zwc ]]; then
  zcompile -R -- "$zcompdump_dir/zcompdump"
fi
