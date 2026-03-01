tl() {
  [[ -z $1 ]] && { echo "Usage: tl <ai>"; return 1; }
  [[ -z $TMUX ]] && { echo "You must start tmux to use tl."; return 1; }

  local current_dir="${PWD}"
  local editor_pane ai_pane
  local ai="$1"

  editor_pane="$TMUX_PANE"

  tmux rename-window -t "$editor_pane" "tl"

  # split editor pane horizontally - AI on right 40%
  ai_pane=$(tmux split-window -h -p 40 -d -t "$editor_pane" -c "$current_dir" -P -F '#{pane_id}')

  tmux send-keys -t "$ai_pane" "$ai" C-m
  tmux send-keys -t "$editor_pane" "$EDITOR" C-m
  tmux select-pane -t "$ai_pane"
}
