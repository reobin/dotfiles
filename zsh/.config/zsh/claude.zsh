claude() {
  local extra=~/.claude/private-settings.json
  if [[ -r $extra ]]; then
    command claude --settings "$extra" "$@"
  else
    command claude "$@"
  fi
}
