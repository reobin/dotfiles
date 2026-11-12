#!/bin/sh
# trim.sh <transcript> <fork file> <fork id>
#
# Copies a Claude transcript up to its last completed turn under a new session
# id, so a fork made mid-turn leaves the in-flight prompt and its partial work
# with the parent. Cuts by file position, not by record type: messages chain
# through attachment records. Prints the effort and permission mode last set
# anywhere in the transcript, tab-separated, for the fork's flags.
#
# Runs outside the mod because transcripts pass the mod runtime's 1 MiB read
# limit within a few turns.
set -eu

transcript="$1"
fork_file="$2"
fork_id="$3"

# The parent may be mid-write; only newline-terminated lines are whole records.
lines="$(wc -l <"$transcript")"

head -n "$lines" "$transcript" | jq -c -s --arg sid "$fork_id" '
  (
    [ to_entries[]
      | select(
          (.value.type == "assistant" and .value.message.stop_reason == "end_turn")
          or (.value.type == "system" and .value.subtype == "turn_duration")
        )
      | .key ]
    | last
  ) as $cut
  | if $cut == null then error("no completed turn to fork from yet") else . end
  | .[0:($cut + 1)][]
  | select(.type != "last-prompt" and .type != "session-owner")
  | if has("sessionId") then .sessionId = $sid else . end
  | if has("session_id") then .session_id = $sid else . end
' >"$fork_file" || {
  rm -f "$fork_file"
  exit 1
}

head -n "$lines" "$transcript" | jq -r -s '
  [ (map(select(.effort != null) | .effort) | last // ""),
    (map(select(.type == "permission-mode") | .permissionMode) | last // "") ]
  | @tsv
' || {
  rm -f "$fork_file"
  exit 1
}
