#!/bin/sh
# Open the visible scrollback in $EDITOR. Takes the invoking pane id as $1.

set -eu

invoking="${1:-${TMUX_PANE:-}}"
if [ -n "$invoking" ]; then
  set -- -t "$invoking"
else
  set --
fi
# shellcheck disable=SC2124
pane="$(tmux display-message "$@" -p '#{pane_id}')"
file="/tmp/tmux-scrollback-${pane#%}.txt"
tmux capture-pane -t "$pane" -p -S -3000 >"$file"
tmux new-window -n scrollback "${EDITOR:-nvim} \"$file\""
