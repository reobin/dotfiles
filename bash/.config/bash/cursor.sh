__bash_restore_cursor() {
  printf '\e[4 q'
}

__bash_add_prompt_command() {
  local cmd=$1

  if [[ $(declare -p PROMPT_COMMAND 2>/dev/null) == "declare -a"* ]]; then
    PROMPT_COMMAND=("$cmd" "${PROMPT_COMMAND[@]}")
  elif [[ -n ${PROMPT_COMMAND:-} ]]; then
    PROMPT_COMMAND="$cmd; $PROMPT_COMMAND"
  else
    PROMPT_COMMAND="$cmd"
  fi
}

__bash_add_prompt_command __bash_restore_cursor
unset -f __bash_add_prompt_command
