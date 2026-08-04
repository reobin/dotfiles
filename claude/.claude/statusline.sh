#!/bin/bash
# Claude Code status line: context usage, session title.
#
# Payload fields (verified against claude-code 2.1.220):
#   .context_window.total_input_tokens
#   .context_window.context_window_size
#   .context_window.used_percentage
#   .session_name                    the /rename title, else the auto-generated topic
#                                    title; absent until one has been generated
#
# Renders e.g.:  68k/1M 7%  Show session titles in pane list
#
# The title trails rather than right-aligning: Claude trims each line of this output
# and renders it in a left-aligned box, so padding cannot push text to the margin.

input=$(cat)

# Split on US (0x1f) so the title keeps its spaces, and so an empty field is never
# collapsed against its neighbour the way IFS whitespace would collapse it.
IFS=$'\x1f' read -r used size pct title <<EOF
$(printf '%s' "$input" | jq -r '
  [ (.context_window.total_input_tokens // 0)
  , (.context_window.context_window_size // 0)
  , (.context_window.used_percentage // 0)
  , (.session_name // "")
  ] | map(tostring) | join("\u001f")')
EOF

# guard the numerics so arithmetic tests never see an empty string
[ -z "$used" ] && used=0
[ -z "$size" ] && size=0
[ -z "$pct" ] && pct=0

RESET=$'\033[0m'
DIM=$'\033[2m'
AMBER=$'\033[38;5;214m'
RED=$'\033[38;5;203m'

# 68432 -> 68k, 1000000 -> 1M, 1500000 -> 1.5M
human() {
  awk -v n="$1" 'BEGIN{
    if (n >= 1000000) { v = n/1000000; printf (v == int(v) ? "%.0fM" : "%.1fM"), v }
    else if (n >= 1000) { printf "%.0fk", n/1000 }
    else { printf "%d", n }
  }'
}

segments=""
add() { [ -n "$segments" ] && segments="${segments}  ${1}" || segments="$1"; }

if [ "$size" -gt 0 ] 2>/dev/null; then
  pct_int=$(awk -v p="$pct" 'BEGIN{printf "%.0f", p}')
  if   [ "$pct_int" -ge 85 ]; then ctx_color="$RED"
  elif [ "$pct_int" -ge 60 ]; then ctx_color="$AMBER"
  else ctx_color="$DIM"
  fi
  add "${ctx_color}$(human "$used")/$(human "$size") ${pct_int}%${RESET}"
fi

# Claude caps titles at 200 chars; clamp further so the line cannot wrap.
if [ -n "$title" ]; then
  [ "${#title}" -gt 56 ] && title="${title:0:55}…"
  add "$title"
fi

printf '%s' "$segments"
