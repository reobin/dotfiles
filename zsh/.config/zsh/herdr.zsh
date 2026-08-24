# Tell the space-tokens plugin when a pane changes directory.
#
# A space with no worktree behind it takes its sidebar title from its first
# pane's directory, and no event Herdr offers plugins carries a cd: pane.updated,
# the one that does, is rejected at plugin link time. This hook is that event.

[[ -n "$HERDR_ENV" ]] || return 0

__herdr_space_tokens_refresh="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/space-tokens/refresh.sh"
[[ -r "$__herdr_space_tokens_refresh" ]] || return 0

# Key the guard on the nearest checkout rather than $PWD: walking deeper into the
# repo the space is already on cannot move the row, and a refresh costs a few
# hundred milliseconds of socket round trips.
__herdr_space_root() {
  local dir="$PWD"

  while [[ -n "$dir" && "$dir" != / ]]; do
    if [[ -e "$dir/.git" ]]; then
      REPLY="$dir"
      return
    fi
    dir="${dir:h}"
  done

  REPLY="$PWD"
}

__herdr_space_tokens_chpwd() {
  emulate -L zsh

  # A cd inside `( ... )` moves nothing the sidebar can read, and the key written
  # below dies with the subshell, so a loop over checkouts would never coalesce.
  [[ $ZSH_SUBSHELL -eq 0 ]] || return 0

  local REPLY
  __herdr_space_root
  [[ "$REPLY" == "$__herdr_space_key" ]] && return 0
  __herdr_space_key="$REPLY"

  # Twice, because Herdr walks to the answer rather than arriving at it: for
  # something under a second after a cd it still reports the old checkout. The
  # first run moves the row now, the second makes it right.
  #
  # Disowned rather than backgrounded so it does not follow the shell to its
  # exit, detached from the terminal, and niced to the floor.
  {
    nice -n 19 sh "$__herdr_space_tokens_refresh"
    sleep 2
    nice -n 19 sh "$__herdr_space_tokens_refresh"
  } </dev/null >/dev/null 2>&1 &!
}

# The pane's own directory is already on the row from the pane.created refresh,
# so seed the key and let the first real cd be the first refresh.
() {
  emulate -L zsh

  local REPLY
  __herdr_space_root
  typeset -g __herdr_space_key="$REPLY"
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd __herdr_space_tokens_chpwd
