#!/bin/sh
# Report a self-expiring `tasks_pending` workspace token when a Claude turn ends
# while background tasks are still running, so the sidebar keeps the working
# mark instead of calling the pane done.
#
# Wired in claude/.claude/settings.json on Stop and SubagentStop. Runs inside
# the pane, where HERDR_WORKSPACE_ID names the space to report on. The
# space-tokens plugin never sets or clears this token; it only reads it back,
# and the TTL bounds any overstatement, for example a transcript that has not
# recorded the just-finished task yet.
#
# Usage: herdr-tasks-pending.sh < hook-input.json
# Never fails: any error exits 0 without reporting.

set -u

[ "${HERDR_ENV:-}" = "1" ] || exit 0
[ -n "${HERDR_WORKSPACE_ID:-}" ] || exit 0
command -v herdr >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat 2>/dev/null || true)"
session="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)" || exit 0
[ -n "$session" ] || exit 0

# A background task gets a file at <session>/tasks/<id>.output, and every one
# that ends is announced back into the transcript as <task-id>: a file with no
# announcement is still running. Ends leaving no marker at all read as pending
# until the TTL below expires rather than being believed forever.
stale_after=1800
cutoff="$(
  date -v-${stale_after}S '+%Y-%m-%d %H:%M:%S' 2>/dev/null ||
    date -d "-$stale_after seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null
)" || exit 0

# /private/tmp is left out beside /tmp: on macOS it is the same directory
# through a symlink, so naming both walks every tasks dir twice.
task_dirs="$(
  find "${TMPDIR:-/tmp}"/claude-* /tmp/claude-* \
    -maxdepth 3 -type d -name tasks 2>/dev/null || true
)"

tasks=""
while IFS= read -r dir; do
  case "$dir" in
    */"$session"/tasks) tasks="$dir"; break ;;
  esac
done <<EOF
$task_dirs
EOF
[ -n "$tasks" ] || exit 0

# -L because these are mostly symlinks into the subagent transcript they report
# on: the link mtime is fixed at creation while the transcript keeps being
# written, so reading the link would age out a subagent still working.
fresh=""
while IFS= read -r output; do
  [ -n "$output" ] || continue
  id="${output##*/}"
  fresh="$fresh${fresh:+ }${id%.output}"
done <<EOF
$(find -L "$tasks" -maxdepth 1 -type f -name '*.output' -newermt "$cutoff" 2>/dev/null)
EOF
[ -n "$fresh" ] || exit 0

transcript=""
while IFS= read -r candidate; do
  case "$candidate" in
    */"$session.jsonl")
      if [ -r "$candidate" ]; then
        transcript="$candidate"
        break
      fi
      ;;
  esac
done <<EOF
$(find "$HOME/.claude/projects" -maxdepth 2 -name '*.jsonl' 2>/dev/null || true)
EOF

# Delimited so the test below is a `case` and not a `grep` per id, and so an id
# that is a prefix of another cannot answer for it. Task ids hold no
# whitespace, so splitting $fresh on it stays safe.
announced="|"
if [ -n "$transcript" ]; then
  # shellcheck disable=SC2086
  hits="$(printf '<task-id>%s\n' $fresh | grep -o -F -f - "$transcript" 2>/dev/null)"
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    announced="$announced${line#<task-id>}|"
  done <<EOF
$hits
EOF
fi

# shellcheck disable=SC2086
for id in $fresh; do
  case "$announced" in
    *"|$id|"*) continue ;;
  esac
  herdr workspace report-metadata "$HERDR_WORKSPACE_ID" \
    --source space-tokens --token tasks_pending=1 --ttl-ms 120000 \
    >/dev/null 2>&1 || true
  exit 0
done

exit 0
