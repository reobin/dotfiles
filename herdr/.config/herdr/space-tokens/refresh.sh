#!/bin/sh

# Report one sidebar line per pane onto each Herdr space, thud.sh style.
#
# Herdr's expanded sidebar is a spaces list plus an agents panel, and a space
# row can only render workspace-level values. So the per-pane lines live here:
# this script turns `pane list` into workspace metadata tokens, and
# [ui.sidebar.spaces] in config.toml decides where those tokens go.
#
# Slots are fixed because rows are: a1..a4 hold the first four panes of a space
# in pane order, each with a `_hot` variant for agent states that want attention
# and a `_title` line for what the agent is doing. Panes past the last slot are
# counted in `more` instead of being dropped silently; the space's own state
# icon still reflects them, so nothing needing attention can hide in there.
#
# Panes without an agent get a single line naming their foreground command, so a
# dev server or an editor reads as part of the space the way it does in thud.
# Set processes=0 to list only agents.
#
# Usage: refresh.sh         report the current panes
#        refresh.sh clear    remove every token this script owns

set -eu

herdr="${HERDR_BIN_PATH:-herdr}"
source_id="space-tokens"
slots=4
processes=1

workspaces="$("$herdr" workspace list)"

if [ "${1:-}" = "clear" ]; then
  args=""
  slot=1
  while [ "$slot" -le "$slots" ]; do
    args="$args --clear-token a$slot --clear-token a${slot}_hot --clear-token a${slot}_title"
    slot=$((slot + 1))
  done
  args="$args --clear-token more"

  for workspace in $(printf '%s' "$workspaces" | jq -r '.result.workspaces[].workspace_id'); do
    # shellcheck disable=SC2086
    "$herdr" workspace report-metadata "$workspace" --source "$source_id" $args >/dev/null
  done

  exit 0
fi

panes="$("$herdr" pane list)"

# Tab labels only mean something once a space has more than one tab, so ask for
# them only then. One extra call per multi-tab space, none in the common case.
tabs='{}'
for workspace in $(printf '%s' "$workspaces" | jq -r '.result.workspaces[] | select(.tab_count > 1) | .workspace_id'); do
  list="$("$herdr" tab list --workspace "$workspace")" || continue
  tabs="$(
    printf '%s\n%s\n' "$tabs" "$list" |
      jq -sc --arg ws "$workspace" '
        .[0] + { ($ws): (.[1].result.tabs | map({ key: .tab_id, value: .label }) | from_entries) }
      '
  )"
done

# Agent panes name themselves; anything else has to be asked what it is running.
# The process group leader is the command that was typed, so `pnpm start` reads
# as `pnpm start` rather than the node process it became.
commands='{}'
if [ "$processes" -eq 1 ]; then
  for pane in $(printf '%s' "$panes" | jq -r '.result.panes[] | select(.agent == null) | .pane_id'); do
    info="$("$herdr" pane process-info --pane "$pane")" || continue
    commands="$(
      printf '%s\n%s\n' "$commands" "$info" |
        jq -sc --arg pane "$pane" '
          .[1].result.process_info as $info
          | ($info.foreground_processes // []) as $running
          | (($running | map(select(.pid == $info.foreground_process_group_id)) | first) // ($running | last)) as $leader
          | (if $leader == null then
               "shell"
             else
               (($leader.argv0 // $leader.name // "shell") | split("/") | last) as $command
               | [$command] + (($leader.argv // [])[1:2]) | join(" ")
             end) as $label
          | .[0] + { ($pane): $label }
        '
    )"
  done
fi

plan="$(
  printf '%s' "$workspaces" |
    jq -r --argjson panes "$panes" --argjson tabs "$tabs" --argjson commands "$commands" --argjson slots "$slots" '
      def mark:
        if . == "blocked" then "◆"
        elif . == "working" then "●"
        elif . == "done" then "●"
        elif . == "idle" then "○"
        else "·"
        end;

      # Blocked waits on you; done is finished background work you have not
      # looked at yet. Both get the bold row.
      def hot: . == "blocked" or . == "done";

      .result.workspaces[]
      | . as $workspace
      | ($panes.result.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
      | ($tabs[$workspace.workspace_id] // {}) as $tab_labels
      | [
          range(1; $slots + 1) as $slot
          | ($mine[$slot - 1]) as $pane
          | if $pane == null then
              ["--clear-token", "a\($slot)", "--clear-token", "a\($slot)_hot", "--clear-token", "a\($slot)_title"]
            elif ($pane.agent // null) == null then
              ([$tab_labels[$pane.tab_id] // empty, $commands[$pane.pane_id] // "shell"] | join(" · ")) as $rest
              | ["--token", "a\($slot)=· \($rest)", "--clear-token", "a\($slot)_hot", "--clear-token", "a\($slot)_title"]
            else
              # Kind, not the agent name: names are long, usually repeat the
              # space label, and would truncate the status word off the line.
              ([$tab_labels[$pane.tab_id] // empty, $pane.agent, $pane.agent_status] | join(" · ")) as $rest
              | "\($pane.agent_status | mark) \($rest)" as $line
              | (if ($pane.agent_status | hot) then
                   ["--token", "a\($slot)_hot=\($line)", "--clear-token", "a\($slot)"]
                 else
                   ["--token", "a\($slot)=\($line)", "--clear-token", "a\($slot)_hot"]
                 end)
                + (($pane.terminal_title_stripped // "") | if . == "" then
                     ["--clear-token", "a\($slot)_title"]
                   else
                     ["--token", "a\($slot)_title=\(.)"]
                   end)
            end
        ]
        + (($mine | length) - $slots | if . > 0 then
             ["--token", "more=+\(.) more"]
           else
             ["--clear-token", "more"]
           end)
      | [$workspace.workspace_id] + flatten
      | @sh
    '
)"

printf '%s\n' "$plan" |
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    # jq quoted every word with @sh, so this only re-splits its own output.
    eval "set -- $line"
    workspace="$1"
    shift
    "$herdr" workspace report-metadata "$workspace" --source "$source_id" "$@" >/dev/null
  done
