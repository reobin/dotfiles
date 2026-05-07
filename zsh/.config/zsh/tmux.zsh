tl() {
  [[ -z $1 ]] && { print "Usage: tl <ai>"; return 1; }
  [[ -z $TMUX ]] && { print "You must start tmux to use tl."; return 1; }

  local current_dir="$PWD"
  local editor_pane="$TMUX_PANE"
  local ai_pane
  local ai="$1"

  ai_pane=$(tmux split-window -h -p 40 -d -t "$editor_pane" -c "$current_dir" -P -F '#{pane_id}')

  tmux send-keys -t "$ai_pane" "$ai" C-m
  tmux select-pane -t "$ai_pane"
}


