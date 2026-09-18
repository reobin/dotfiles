# Tell the space-tokens plugin what this pane is doing.
#
# A command starting is not an event a plugin can hook, and pane.updated, the
# only event carrying a cd or a title, is rejected at plugin link time. These
# hooks are those events. A command ending needs no hook: the status change it
# causes already emits a plugin event.

[[ -n "$HERDR_ENV" ]] || return 0

__herdr_space_tokens_refresh="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/space-tokens/refresh.sh"
[[ -r "$__herdr_space_tokens_refresh" ]] || return 0

# Key the guard on the nearest checkout rather than $PWD: walking deeper into the
# repo the space is already on cannot move the row, and a refresh costs a few
# hundred milliseconds of socket round trips.
__herdr_space_root() {
  local dir="${1:-$PWD}"

  while [[ -n "$dir" && "$dir" != / ]]; do
    if [[ -e "$dir/.git" ]]; then
      REPLY="$dir"
      return
    fi
    dir="${dir:h}"
  done

  REPLY="${1:-$PWD}"
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

  # One run now, then a verify: for something under a second after a cd Herdr
  # still reports the old checkout, so the second run only happens when the
  # pane Herdr sees is still behind the checkout this cd landed on.
  #
  # Disowned rather than backgrounded so it does not follow the shell to its
  # exit, detached from the terminal, and niced to the floor.
  local target="$REPLY" pane="$HERDR_PANE_ID"
  {
    nice -n 19 sh "$__herdr_space_tokens_refresh"
    sleep 2
    # The check below reads live Herdr state, so a cd that landed after this
    # one just converges on the next verify: a refresh recomputes every space.
    local seen=""
    if [[ -n "$pane" ]]; then
      seen="$(herdr api snapshot 2>/dev/null | jq -r --arg p "$pane" \
        '.result.snapshot.panes[] | select(.pane_id == $p) | .cwd // empty')"
    fi
    # An unreadable answer keeps the old always-rerun behavior.
    [[ -n "$seen" ]] || { nice -n 19 sh "$__herdr_space_tokens_refresh"; exit 0; }
    local REPLY
    __herdr_space_root "$seen"
    [[ "$REPLY" == "$target" ]] || nice -n 19 sh "$__herdr_space_tokens_refresh" </dev/null >/dev/null 2>&1
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
# Starts are debounced, endings are not: a start only renames the row, while the
# ending is what returns it to `shell`, so skipping it would stick the row on a
# finished command. Rapid-fire commands still share one start refresh per 2s.
#
# Disowned rather than backgrounded so they do not follow the shell to its exit,
# detached from the terminal, and niced to the floor.
__herdr_space_tokens_preexec() {
  emulate -L zsh

  # A command ran, even when the refresh below debounces away: precmd uses this
  # to know the row needs returning to `shell`.
  typeset -g __herdr_space_tokens_ran=1

  local now="${EPOCHREALTIME:-$(date +%s)}"
  if [[ -n "$__herdr_space_tokens_last_run" ]]; then
    # Integer compare on the whole-seconds part: portable, and a 2s window does
    # not need the fraction.
    if (( ${now%.*} - ${__herdr_space_tokens_last_run%.*} < 2 )); then
      return 0
    fi
  fi
  typeset -g __herdr_space_tokens_last_run="$now"

  nice -n 19 sh "$__herdr_space_tokens_refresh" </dev/null >/dev/null 2>&1 &!
}

__herdr_space_tokens_precmd() {
  emulate -L zsh

  # An empty line at the prompt reaches precmd with no preexec before it, and
  # nothing has moved since the last run.
  [[ -n "$__herdr_space_tokens_ran" ]] || return 0
  unset __herdr_space_tokens_ran

  typeset -g __herdr_space_tokens_last_run="${EPOCHREALTIME:-$(date +%s)}"

  nice -n 19 sh "$__herdr_space_tokens_refresh" </dev/null >/dev/null 2>&1 &!
}

add-zsh-hook preexec __herdr_space_tokens_preexec
add-zsh-hook precmd __herdr_space_tokens_precmd
