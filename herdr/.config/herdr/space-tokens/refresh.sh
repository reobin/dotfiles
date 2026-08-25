#!/bin/sh

# Report one sidebar line per pane onto each Herdr space.
#
# A space row can only render workspace-level values, so the per-pane lines live
# here: this turns `pane list` into workspace metadata tokens, and
# [ui.sidebar.spaces] in config.toml decides where those tokens go.
#
# Usage: refresh.sh         report the current panes
#        refresh.sh clear    remove every token this script owns

set -eu

herdr="${HERDR_BIN_PATH:-herdr}"
source_id="space-tokens"
# Capped by the rows [ui.sidebar.spaces] has to give, which leaves room up to 13.
# Past that the config goes over Herdr's row cap, which it answers by discarding
# the file and using defaults.
slots=6
processes=1

# A report may carry at most 16 tokens. Exceeding it fails the whole report and
# nothing logs that, so the sidebar just stops changing.
batch=16

workspaces="$("$herdr" workspace list)"

if [ "${1:-}" = "clear" ]; then
  names=""
  slot=1
  while [ "$slot" -le "$slots" ]; do
    names="$names a$slot a${slot}_blocked a${slot}_working a${slot}_done"
    slot=$((slot + 1))
  done
  names="$names more more_blocked title"

  for workspace in $(printf '%s' "$workspaces" | jq -r '.result.workspaces[].workspace_id'); do
    args=""
    count=0
    # Token names carry no whitespace, so splitting the list on it is safe.
    # shellcheck disable=SC2086
    for name in $names; do
      args="$args --clear-token $name"
      count=$((count + 1))
      if [ "$count" -eq "$batch" ]; then
        # shellcheck disable=SC2086
        "$herdr" workspace report-metadata "$workspace" --source "$source_id" $args >/dev/null
        args=""
        count=0
      fi
    done
    if [ "$count" -gt 0 ]; then
      # shellcheck disable=SC2086
      "$herdr" workspace report-metadata "$workspace" --source "$source_id" $args >/dev/null
    fi
  done

  exit 0
fi

panes="$("$herdr" pane list)"

tabs='{}'
for workspace in $(printf '%s' "$workspaces" | jq -r '.result.workspaces[] | select(.tab_count > 1) | .workspace_id'); do
  list="$("$herdr" tab list --workspace "$workspace" 2>/dev/null)" || continue
  tabs="$(
    printf '%s\n%s\n' "$tabs" "$list" |
      jq -sc --arg ws "$workspace" '
        .[0] + { ($ws): (.[1].result.tabs | map({ key: .tab_id, value: .label }) | from_entries) }
      '
  )"
done

# The same answer carries the checkout this space is open on, which the title row
# needs below. A space outside a repo answers with an error rather than an empty
# name, so that error is the expected answer for those spaces and would otherwise
# be logged on every run, once per space.
repos='{}'
for workspace in $(printf '%s' "$workspaces" | jq -r '.result.workspaces[].workspace_id'); do
  info="$("$herdr" worktree list --workspace "$workspace" 2>/dev/null)" || continue
  repos="$(
    printf '%s\n%s\n' "$repos" "$info" |
      jq -sc --arg ws "$workspace" '
        .[1].result as $result
        | ($result.source.repo_name // "") as $repo
        | ((($result.worktrees // [])
            | map(select(.open_workspace_id == $ws)) | first | .path)
           // $result.source.repo_root // "") as $path
        | if $repo == "" then .[0] else .[0] + { ($ws): { name: $repo, path: $path } } end
      '
  )"
done

# Which spaces someone has named. The socket cannot say: it answers with the
# custom name when there is one and the checkout basename when there is not, in
# the same field, so a space named after its own checkout is invisible there.
# This is Herdr's own state file rather than an API, so a shape that changes under
# it or no file at all falls back to {}, leaving only the label comparison below.
session_file="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/session.json"
named='{}'
if [ -r "$session_file" ]; then
  named="$(
    jq -c '[.workspaces[]? | select(.custom_name != null) | { key: .id, value: true }] | from_entries' \
      "$session_file" 2>/dev/null
  )" || named='{}'
fi

# The process group leader is the command that was typed, so `pnpm start` reads as
# `pnpm start` rather than the node process it became.
commands='{}'
if [ "$processes" -eq 1 ]; then
  for pane in $(printf '%s' "$panes" | jq -r '.result.panes[] | select(.agent == null) | .pane_id'); do
    info="$("$herdr" pane process-info --pane "$pane" 2>/dev/null)" || continue
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

# A Claude turn ends while the work it started keeps running, so the pane goes
# idle and the row calls it done. Claude gives every background task a file at
# <session>/tasks/<id>.output and announces every one that ends back into its own
# transcript as <task-id>, so what has a file and no announcement is still
# running. Some ends leave no marker at all -- a Monitor timing out, a task
# stopped from the UI -- so a file nothing has written to in $stale_after seconds
# is read as one of those rather than believed forever.
stale_after=1800
now="$(date +%s)"
pending='{}'
while IFS=' ' read -r pane session; do
  [ -n "$session" ] || continue

  tasks=""
  for base in "${TMPDIR:-/tmp}" /tmp /private/tmp; do
    for dir in "$base"/claude-*/*/"$session"/tasks; do
      if [ -d "$dir" ]; then
        tasks="$dir"
        break
      fi
    done
    [ -z "$tasks" ] || break
  done
  [ -n "$tasks" ] || continue

  fresh=""
  for output in "$tasks"/*.output; do
    [ -f "$output" ] || continue
    # BSD and GNU stat spell this differently and the plugin runs on both. GNU
    # goes first because it is the one that fails cleanly: BSD rejects -c as an
    # illegal option, while GNU reads -f as --file-system, which takes no
    # argument, so %m becomes an operand and its report lands on stdout.
    mtime="$(stat -c %Y "$output" 2>/dev/null || stat -f %m "$output" 2>/dev/null)" || continue
    [ "$((now - mtime))" -lt "$stale_after" ] || continue
    id="${output##*/}"
    fresh="$fresh${fresh:+
}${id%.output}"
  done
  [ -n "$fresh" ] || continue

  transcript=""
  for candidate in "$HOME/.claude/projects"/*/"$session.jsonl"; do
    if [ -r "$candidate" ]; then
      transcript="$candidate"
      break
    fi
  done

  announced=""
  if [ -n "$transcript" ]; then
    announced="$(
      # Task ids carry no whitespace, so splitting the list on it is safe.
      # shellcheck disable=SC2086
      printf '<task-id>%s\n' $fresh |
        grep -o -F -f - "$transcript" 2>/dev/null |
        sed 's/^<task-id>//' |
        sort -u
    )" || announced=""
  fi

  count=0
  # shellcheck disable=SC2086
  for id in $fresh; do
    if [ -n "$announced" ] && printf '%s\n' "$announced" | grep -qxF "$id"; then
      continue
    fi
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || continue

  pending="$(printf '%s' "$pending" | jq -c --arg pane "$pane" --argjson count "$count" '. + { ($pane): $count }')"
done <<EOF
$(printf '%s' "$panes" | jq -r '
  .result.panes[]
  | select(.agent_status == "done" or .agent_status == "idle")
  | select((.agent_session.kind // "") == "id")
  | "\(.pane_id) \(.agent_session.value)"
')
EOF

plan="$(
  printf '%s' "$workspaces" |
    jq -r --argjson panes "$panes" --argjson tabs "$tabs" --argjson commands "$commands" --argjson slots "$slots" \
      --argjson repos "$repos" --argjson named "$named" --argjson pending "$pending" --argjson batch "$batch" '
      def mark:
        if . == "blocked" then "×"
        elif . == "working" then "◐"
        elif . == "done" then "✓"
        elif . == "idle" then "○"
        else "·"
        end;

      def basename: (. / "/") | map(select(. != "")) | last // "";

      # Rows are static, so the color is chosen by which token carries a value:
      # set one and clear the rest, or the row renders both joined by " · ".
      def slots_of($slot): ["a\($slot)", "a\($slot)_blocked", "a\($slot)_working", "a\($slot)_done"];
      def clear_but($slot; $keep):
        [slots_of($slot)[] | select(IN($keep[]) | not) | ("--clear-token", .)];

      def title_of($workspace):
        ($panes.result.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
        | ($repos[$workspace.workspace_id] // {}) as $git
        | ($git.name // "") as $repo
        | ($mine[0].cwd // "") as $cwd
        | ($workspace.label // "") as $label
        | ([$repo, ($cwd | basename), $label] | map(select(. != "")) | first // "") as $where
        # Herdr walks to the checkout rather than arriving at it: for about half a
        # second after a cd the label is the basename of the directory itself.
        # Both spellings count as unnamed, or a refresh landing inside that window
        # takes the difference for a name and staples the directory to the row.
        | [((if ($git.path // "") != "" then $git.path else $cwd end) | basename),
           ($cwd | basename)] as $unnamed
        # Two signals: the session file is exact but Herdr flushes it seconds
        # after a rename, and a label differing from the basename covers those
        # seconds. A space nobody named trips neither.
        | (($named[$workspace.workspace_id] // false)
           or ($unnamed | index($label)) == null) as $chosen
        | if $chosen and $label != "" and $label != $where
          then "\($where) · \($label)"
          else $where
          end;

      .result.workspaces[]
      | . as $workspace
      | title_of(.) as $title
      | ($panes.result.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
      | ($tabs[$workspace.workspace_id] // {}) as $tab_labels
      | [if $title == "" then ["--clear-token", "title"] else ["--token", "title=\($title)"] end]
      + [
          range(1; $slots + 1) as $slot
          | ($mine[$slot - 1]) as $pane
          | if $pane == null then
              clear_but($slot; [])
            elif ($pane.agent // null) == null then
              ([$tab_labels[$pane.tab_id] // empty, $commands[$pane.pane_id] // "shell"] | join(" · ")) as $rest
              | ["--token", "a\($slot)=· \($rest)"] + clear_but($slot; ["a\($slot)"])
            else
              # Claude prefixes its title with a spinner frame, which reads as a
              # second, contradicting status glyph next to the mark. Dropping a
              # leading run of symbols that reaches whitespace without passing a
              # letter spares a bracketed prefix like [wip].
              ($pane.terminal_title_stripped // "" | sub("^[^\\p{L}\\p{N}]+\\s+"; "")) as $title
              | (if $title == "" then $pane.agent else $title end) as $what
              | ([$tab_labels[$pane.tab_id] // empty, $what] | join(" · ")) as $rest
              | ($pending[$pane.pane_id] // 0) as $waiting
              # The count rides on the glyph rather than the end of the line,
              # which is a title and gets truncated. One is what the glyph already
              # means, so only a second task is worth the column.
              | (if $waiting > 1 then "\("working" | mark)\($waiting)"
                 elif $waiting == 1 then ("working" | mark)
                 else ($pane.agent_status | mark)
                 end) as $icon
              | (if $pane.agent_status == "blocked" then "a\($slot)_blocked"
                 elif $waiting > 0 or $pane.agent_status == "working" then "a\($slot)_working"
                 elif $pane.agent_status == "done" then "a\($slot)_done"
                 else "a\($slot)"
                 end) as $slot_token
              | ["--token", "\($slot_token)=\($icon) \($rest)"]
                + clear_but($slot; [$slot_token])
            end
        ]
        + [$mine[$slots:] as $hidden
           | if ($hidden | length) == 0 then
               ["--clear-token", "more", "--clear-token", "more_blocked"]
             else
               ([$hidden[] | select(.agent_status == "blocked")] | length) as $blocked
               # A pane counted as waiting is not also counted as done, or the
               # same agent shows up twice in a line whose whole job is a tally.
               | ([$hidden[] | select(($pending[.pane_id] // 0) > 0
                                      or .agent_status == "working")] | length) as $waiting
               | ([$hidden[] | select(.agent_status == "done")
                             | select(($pending[.pane_id] // 0) == 0)] | length) as $done
               | ([
                   (if $blocked > 0 then "\($blocked)\("blocked" | mark)" else empty end),
                   (if $waiting > 0 then "\($waiting)\("working" | mark)" else empty end),
                   (if $done > 0 then "\($done)\("done" | mark)" else empty end)
                 ] | join(" ")) as $flags
               | (if $flags == "" then "" else " · \($flags)" end) as $tail
               | "+\($hidden | length) more\($tail)" as $line
               | (if $blocked > 0 then
                    ["--token", "more_blocked=\($line)", "--clear-token", "more"]
                  else
                    ["--token", "more=\($line)", "--clear-token", "more_blocked"]
                  end)
             end]
      # One line per report rather than per space, because a space owns more
      # tokens than one report may carry. Groups are packed rather than sliced:
      # the set and the clears for a slot have to land in the same report, or
      # between the two the sidebar draws the new line and the leftover one
      # together on the row they share.
      | reduce .[] as $group ([];
          if length == 0 or ((.[-1] | length) + ($group | length)) > ($batch * 2)
          then . + [$group]
          else .[0:-1] + [.[-1] + $group]
          end)
      | .[]
      | [$workspace.workspace_id] + .
      # An argument holds spaces and a token value holds whatever an agent put in
      # its title, so nothing here may go back through word splitting.
      | (.[], "")
    '
)"

printf '%s\n' "$plan" |
  {
    # Appending a line at a time is the one way to carry arguments with spaces
    # through POSIX sh without re-parsing them.
    set --
    while IFS= read -r arg; do
      if [ -n "$arg" ]; then
        set -- "$@" "$arg"
        continue
      fi

      [ "$#" -gt 0 ] || continue
      workspace="$1"
      shift
      "$herdr" workspace report-metadata "$workspace" --source "$source_id" "$@" >/dev/null
      set --
    done
  }
