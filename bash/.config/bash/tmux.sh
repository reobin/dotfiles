tl() {
  [[ -z $1 ]] && { echo "Usage: tl <ai>"; return 1; }
  [[ -z $TMUX ]] && { echo "You must start tmux to use tl."; return 1; }

  local current_dir="${PWD}"
  local editor_pane ai_pane
  local ai="$1"

  editor_pane="$TMUX_PANE"

  # split editor pane horizontally - AI on right 40%
  ai_pane=$(tmux split-window -h -p 40 -d -t "$editor_pane" -c "$current_dir" -P -F '#{pane_id}')

  tmux send-keys -t "$ai_pane" "$ai" C-m
  tmux send-keys -t "$editor_pane" "$EDITOR" C-m
  tmux select-pane -t "$ai_pane"
}

tmux_session_name_refresh() {
  [[ -z $TMUX ]] && return 0

  local session_id
  session_id=$(tmux display-message -p '#{session_id}' 2>/dev/null) || return 0
  ~/.config/tmux/tmux-session-name.sh "$session_id"
}

__tmux_refresh_name_on_pwd_change() {
  [[ -z $TMUX ]] && return 0

  if [[ "$PWD" == "$__tmux_last_pwd" ]]; then
    return 0
  fi
  __tmux_last_pwd="$PWD"

  local session_id
  session_id=$(tmux display-message -p '#{session_id}' 2>/dev/null) || return 0

  ~/.config/tmux/tmux-session-name.sh "$session_id"
}

if [[ -n $TMUX ]]; then
  if [[ ";$PROMPT_COMMAND;" != *";__tmux_refresh_name_on_pwd_change;"* ]]; then
    PROMPT_COMMAND="__tmux_refresh_name_on_pwd_change${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
  fi
fi
