#!/bin/sh
# Toggle a two-pane window between side-by-side and stacked, keeping focus.
# Takes the invoking pane id as $1.

set -eu

invoking="${1:-${TMUX_PANE:-}}"
if [ -n "$invoking" ]; then
  set -- -t "$invoking"
else
  set --
fi
# shellcheck disable=SC2124
panes="$(tmux list-panes "$@" -F '#{pane_id} #{pane_top} #{pane_active}')"

if [ "$(printf '%s\n' "$panes" | wc -l | tr -d ' ')" -ne 2 ]; then
  tmux display-message "toggle split needs exactly two panes"
  exit 0
fi

first="$(printf '%s\n' "$panes" | sed -n '1p' | cut -d' ' -f1)"
second="$(printf '%s\n' "$panes" | sed -n '2p' | cut -d' ' -f1)"
top1="$(printf '%s\n' "$panes" | sed -n '1p' | cut -d' ' -f2)"
top2="$(printf '%s\n' "$panes" | sed -n '2p' | cut -d' ' -f2)"
active="$(printf '%s\n' "$panes" | awk '$3 == 1 { print $1 }')"

tmp="__toggle_$$"

# Park the pane in a scratch window, then join it back with the other split
# direction. The scratch window closes itself.
tmux break-pane -d -s "$second" -n "$tmp"

if [ "$top1" = "$top2" ]; then
  tmux join-pane -d -v -s "$tmp" -t "$first"
else
  tmux join-pane -d -h -s "$tmp" -t "$first"
fi

tmux select-pane -t "$active"
