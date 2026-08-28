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

# Put the last command line on the pane row.
#
# The row otherwise names the process behind the pane, which is `shell` for every
# pane not busy at the moment it was drawn, so a finished `pnpm start` leaves
# nothing behind. A pane token rides on the pane, outlives the process and dies
# with the pane; refresh.sh prefers it over the process.
zmodload -F zsh/datetime p:EPOCHREALTIME 2>/dev/null

__herdr_last_command_preexec() {
  emulate -L zsh
  setopt extended_glob

  [[ -n "$HERDR_PANE_ID" ]] || return 0

  # The line as typed, so an alias reads as the alias. Two words, the shape
  # refresh.sh already takes from a process leader: `pnpm start` stays whole and
  # `git commit -m ...` reads as `git commit`.
  local -a words
  words=(${(z)1})

  # What leads the line is not always the command. `NODE_ENV=production node`
  # names node, and a redirection carries its target off with it.
  while (( $#words )); do
    case "$words[1]" in
      ([A-Za-z_][A-Za-z0-9_]#=*) shift words ;;
      ([0-9\&]#(\<|\>)[\<\>\&\|]#) shift words; (( $#words )) && shift words ;;
      (*) break ;;
    esac
  done

  local label="${words[1,2]}"
  [[ -n "$label" ]] || return 0

  # A command repeated back to back moves no row, and a refresh costs a few
  # hundred milliseconds of socket round trips.
  [[ "$label" == "$__herdr_last_command" ]] && return 0
  typeset -g __herdr_last_command="$label"

  # Herdr keeps the highest sequence a source has reported for a pane and drops
  # what arrives behind it. Two commands typed in quick succession leave two
  # reports in flight with nothing else to order them. Milliseconds rather than a
  # counter, so a shell replaced in place does not start again from behind.
  local -a seq
  [[ -n "$EPOCHREALTIME" ]] && seq=(--seq "${${EPOCHREALTIME/./}[1,13]}")

  # The report has to land before the refresh reads the snapshot, hence one
  # subshell for both. Disowned rather than backgrounded so it does not follow
  # the shell to its exit, detached from the terminal, and niced to the floor.
  {
    "${HERDR_BIN_PATH:-herdr}" pane report-metadata "$HERDR_PANE_ID" \
      --source last-command "${seq[@]}" --token "cmd=$label" &&
      nice -n 19 sh "$__herdr_space_tokens_refresh"
  } </dev/null >/dev/null 2>&1 &!
}

add-zsh-hook preexec __herdr_last_command_preexec
