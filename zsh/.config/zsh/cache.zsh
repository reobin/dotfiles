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

# Source a script through a compiled copy, so zsh loads bytecode instead of
# reparsing it. The copy is refreshed when the original changes.
#
#   zsh_source_compiled <file>
#
# The copy lives in the cache rather than next to the original, which keeps
# generated files out of the Homebrew prefix. Only pass files that survive being
# relocated: ZERO below is a plugin-manager convention, honored just by plugins
# that open with the `0="${${ZERO:-...}...}"` idiom. One reading ${0:h} directly
# gets the cache directory and breaks, so leave those to a plain `source`.
#
# `cp -p` carries the original's mtime onto the copy, so the two match exactly
# while the copy is current and the check below is a version comparison rather
# than source-mtime against last-copy-time. Homebrew bakes the bottling date
# into poured files, so an upgrade can land a *older* mtime than the copy; a
# one-directional `-nt` test would keep sourcing the superseded version forever.
zsh_source_compiled() {
  local file=$1
  [[ -r $file ]] || return 1

  # Own subdirectory: these are keyed by basename, and zsh_cached_eval keys by
  # name, so a plugin file called <name>.zsh would otherwise clobber its cache.
  local dir=$ZSH_CACHE_DIR/src
  local cache=$dir/${file:t}

  if [[ ! -s $cache || $file -nt $cache || $file -ot $cache ]]; then
    [[ -d $dir ]] || command mkdir -p $dir || return 1

    # Stage under a pid-suffixed name and rename, so a shell starting up in
    # another pane never sources a half-written copy. The old bytecode is
    # dropped before the swap, since zcompile stamps the source name into the
    # digest and can only run against the final path: a shell landing in the
    # gap reads the new text uncompiled rather than the previous version.
    local tmp=$cache.$$
    command cp -pf $file $tmp || { command rm -f $tmp; return 1 }
    command rm -f $cache.zwc
    command mv -f $tmp $cache || { command rm -f $tmp; return 1 }
    zcompile -R -- $cache 2>/dev/null
  fi

  local ZERO=$file
  source $cache
}
