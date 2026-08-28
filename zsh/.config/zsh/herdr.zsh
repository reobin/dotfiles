# Tell the space-tokens plugin what this pane is doing.
#
# Neither of the two things below reaches a plugin on its own: pane.updated, the
# only event carrying a cd or a title, is rejected at plugin link time, and a
# command starting is not an event at all. These hooks are those events.

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

# Refresh the row on either side of a command.
#
# The row names the process behind the pane, which refresh.sh reads at the moment
# it runs, and neither a command starting nor a command ending is an event a
# plugin can hook. These hooks are those events: the first run catches the
# command, the second finds the prompt back and the row returns to `shell`.
#
# Disowned rather than backgrounded so they do not follow the shell to its exit,
# detached from the terminal, and niced to the floor.
__herdr_space_tokens_preexec() {
  emulate -L zsh

  typeset -g __herdr_space_tokens_ran=1
  nice -n 19 sh "$__herdr_space_tokens_refresh" </dev/null >/dev/null 2>&1 &!
}

__herdr_space_tokens_precmd() {
  emulate -L zsh

  # An empty line at the prompt reaches precmd with no preexec before it, and
  # nothing has moved since the last run.
  [[ -n "$__herdr_space_tokens_ran" ]] || return 0
  unset __herdr_space_tokens_ran

  nice -n 19 sh "$__herdr_space_tokens_refresh" </dev/null >/dev/null 2>&1 &!
}

add-zsh-hook preexec __herdr_space_tokens_preexec
add-zsh-hook precmd __herdr_space_tokens_precmd
