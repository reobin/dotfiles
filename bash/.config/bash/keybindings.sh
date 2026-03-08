_edit_command_line() {
  local tmpfile=$(mktemp /tmp/bash-edit-XXXXXX.sh)
  trap 'rm -f "$tmpfile"' EXIT
  printf '%s' "$READLINE_LINE" > "$tmpfile"
  nvim "$tmpfile"
  READLINE_LINE=$(< "$tmpfile")
  READLINE_POINT=${#READLINE_LINE}
}

bind -x '"\C-x": _edit_command_line'
