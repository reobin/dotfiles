#!/bin/sh
# Refresh the spaces-sidebar sidebar rows from inside a Claude turn, so a title
# Claude changes mid-turn reaches its row before the turn ends. pane.updated is
# the only Herdr event carrying a title change, and plugins may not hook it.
#
# Wired in claude/.claude/settings.json on PostToolUse. A turn runs a tool every
# few seconds and every pane runs this hook, so one stamp shared by all of them
# allows one refresh per window. Never fails: any error exits 0.

[ "${HERDR_ENV:-}" = "1" ] || exit 0

refresh="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/spaces-sidebar/refresh.sh"
[ -r "$refresh" ] || exit 0

window=10
stamp="${XDG_CACHE_HOME:-$HOME/.cache}/herdr/spaces-sidebar/claude-stamp"
mkdir -p "${stamp%/*}" 2>/dev/null || exit 0

now="$(date +%s)"
last="$(cat "$stamp" 2>/dev/null || echo 0)"
case "$last" in '' | *[!0-9]*) last=0 ;; esac
[ $((now - last)) -ge "$window" ] || exit 0
printf '%s' "$now" >"$stamp"

sh "$refresh" >/dev/null 2>&1 || true
exit 0
