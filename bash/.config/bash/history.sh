hist() {
  local cmd edited
  cmd=$(HISTTIMEFORMAT='' history | fzf --tac --no-sort --height=40% --reverse) || return
  cmd=$(printf '%s' "$cmd" | sed 's/^ *[0-9]\+ \+//')
  [ -z "$cmd" ] && return
  read -e -i "$cmd" -p "> " edited
  [ -n "$edited" ] && eval "$edited"
}
