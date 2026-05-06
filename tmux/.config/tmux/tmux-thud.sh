#!/bin/sh

window_id=$(tmux display-message -p '#{window_id}')
pane_id=$(tmux display-message -p '#{pane_id}')

thud_pane=$(tmux show-options -wqv -t "$window_id" @thud_pane 2>/dev/null)

if [ -n "$thud_pane" ] && tmux display-message -p -t "$thud_pane" '#{pane_id}' >/dev/null 2>&1; then
  tmux kill-pane -t "$thud_pane"
  tmux set-option -wq -u -t "$window_id" @thud_pane
else
  tmux set-option -wq -u -t "$window_id" @thud_pane
  thud_pane=$(tmux split-window -P -F '#{pane_id}' -d -hb -l 30 -t "$pane_id" "thud")
  tmux set-option -wq -t "$window_id" @thud_pane "$thud_pane"
fi
