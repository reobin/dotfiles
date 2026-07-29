ZSH_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/init"

# Source the cached output of a slow `tool init` command instead of spawning the
# tool on every shell startup. The cache is rebuilt when the tool binary changes
# or when the command below is edited, and compiled so zsh skips reparsing it.
#
#   zsh_cached_eval <name> <command> [args...]
#
# Delete ~/.cache/zsh to force a rebuild.
zsh_cached_eval() {
  local name=$1
  shift

  local bin
  bin=$(command -v "$1") || return 1

  local cache=$ZSH_CACHE_DIR/$name.zsh
  local stamp="# $bin $*"
  local first=

  # `read` is a builtin, so checking the stamp costs no subprocess.
  [[ -s $cache ]] && read -r first < $cache

  if [[ $first != "$stamp" || $bin -nt $cache ]]; then
    [[ -d $ZSH_CACHE_DIR ]] || command mkdir -p $ZSH_CACHE_DIR || return 1

    local tmp=$cache.$$
    print -r -- "$stamp" > $tmp || return 1
    if ! "$@" >> $tmp 2>/dev/null; then
      command rm -f $tmp
      return 1
    fi

    command mv -f $tmp $cache || return 1
    zcompile -R -- $cache 2>/dev/null
  fi

  source $cache
}
