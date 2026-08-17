#!/bin/sh

# Report one sidebar line per pane onto each Herdr space, thud.sh style.
#
# Herdr's expanded sidebar is a spaces list plus an agents panel, and a space
# row can only render workspace-level values. So the per-pane lines live here:
# this script turns `pane list` into workspace metadata tokens, and
# [ui.sidebar.spaces] in config.toml decides where those tokens go.
#
# Slots are fixed because rows are: a1..a6 hold the first six panes of a space in
# pane order, each with the token variants that decide how far the loud color
# reaches into the row. Panes past the last slot are counted in `more` instead of
# being dropped silently, and that count says how many of them are waiting, so
# nothing needing attention can hide in there.
#
# An agent's line is its terminal title. What the agent is doing is what the line
# is for, and the state icon already carries the status, so neither the status
# word nor the agent kind earns a column next to it. The kind stands in only for
# an agent that has not set a title yet.
#
# Panes without an agent get a single line naming their foreground command, so a
# dev server or an editor reads as part of the space the way it does in thud.
# Set processes=0 to list only agents.
#
# `title` stands in for the label on the title row: the repo name when the space
# is in a git repo, the directory name otherwise. Labels are bare basenames, so a
# worktree label says nothing about which repo it belongs to; the branch row
# under the title is what tells one checkout of a repo from another. Two spaces on
# one checkout share a title, so the lower one takes a number.
#
# Usage: refresh.sh         report the current panes
#        refresh.sh clear    remove every token this script owns

set -eu

herdr="${HERDR_BIN_PATH:-herdr}"
source_id="space-tokens"
# Six is the ceiling, not a preference: [ui.sidebar.spaces] has no rows left to
# give one. Raising this alone reports tokens no row renders; raising both puts
# the config over Herdr's row cap, which it answers by throwing the whole file
# away and running on defaults.
slots=6
processes=1

# A report may carry at most 16 tokens, and a full space owns more than that, so
# every write here goes out in batches of this size. Exceeding it fails the whole
# report, and nothing logs that, so the sidebar just stops changing.
batch=16

workspaces="$("$herdr" workspace list)"

if [ "${1:-}" = "clear" ]; then
  names=""
  slot=1
  while [ "$slot" -le "$slots" ]; do
    names="$names a$slot a${slot}_blocked a${slot}_done"
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

# Tab labels only mean something once a space has more than one tab, so ask for
# them only then. One extra call per multi-tab space, none in the common case.
# A space can close between the two calls, and every failure here is a name this
# run does without, so none of them are worth a line in the plugin log.
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

# Which repo a space belongs to is not in its path in any reliable way, and Herdr
# already tracks it, so ask. Spaces outside a repo report no name and fall back
# to their directory below. One call per space.
#
# The same answer carries the checkout this space is open on, which the title row
# needs below, so it is kept here rather than bought with a second call. The
# space's own worktree is the entry claiming it; a space on the main checkout
# claims none, and the repo root is that same directory anyway.
#
# A space outside a repo answers with an error rather than an empty name, so that
# error is the expected answer for those spaces and would otherwise be logged on
# every run, once per space, until a real failure had nowhere left to stand out.
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
# `git wt` names a worktree directory after its branch, so a label taken from
# that branch lands on exactly that collision. This file has the answer, because
# it carries custom_name only for the spaces that have one.
#
# Herdr's own state file rather than an API, so it is a hint and not the answer:
# a shape that changes under it or no file at all falls back to {} and costs
# nothing the label comparison below does not already catch.
session_file="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/session.json"
named='{}'
if [ -r "$session_file" ]; then
  named="$(
    jq -c '[.workspaces[]? | select(.custom_name != null) | { key: .id, value: true }] | from_entries' \
      "$session_file" 2>/dev/null
  )" || named='{}'
fi

# Agent panes name themselves; anything else has to be asked what it is running.
# The process group leader is the command that was typed, so `pnpm start` reads
# as `pnpm start` rather than the node process it became. A pane can exit between
# `pane list` and this call, which costs this run one label and nothing else.
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

plan="$(
  printf '%s' "$workspaces" |
    jq -r --argjson panes "$panes" --argjson tabs "$tabs" --argjson commands "$commands" --argjson slots "$slots" \
      --argjson repos "$repos" --argjson named "$named" --argjson batch "$batch" '
      # Every status gets its own glyph. Bold marks the blocked row, and it also
      # marks the title row, so it cannot be what tells done from working.
      def mark:
        if . == "blocked" then "◆"
        elif . == "working" then "●"
        elif . == "done" then "✓"
        elif . == "idle" then "○"
        else "·"
        end;

      # Last segment of a path, tolerating a trailing slash and an empty string.
      def basename: (. / "/") | map(select(. != "")) | last // "";

      # A slot owns one token per color a line can take, and [ui.sidebar.spaces]
      # explains which. Rows are static, so the color is chosen by which token
      # carries a value: set one and clear the rest, or the row renders both
      # joined by " · ".
      def slots_of($slot): ["a\($slot)", "a\($slot)_blocked", "a\($slot)_done"];
      def clear_but($slot; $keep):
        [slots_of($slot)[] | select(IN($keep[]) | not) | ("--clear-token", .)];

      def title_of($workspace):
        ($panes.result.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
        | ($repos[$workspace.workspace_id] // {}) as $git
        | ($git.name // "") as $repo
        | ($mine[0].cwd // "") as $cwd
        | ($workspace.label // "") as $label
        # The title row renders this instead of the label, so every space has to
        # come out with a name: repo, else the directory it sits in, else the
        # label for a space with no pane to read a cwd from.
        | ([$repo, ($cwd | basename), $label] | map(select(. != "")) | first // "") as $where
        # What Herdr would be putting in the label if nobody had named the space.
        # Read off the checkout rather than the pane cwd, which moves with every
        # cd and would make a space look named for having been walked into.
        | ((if ($git.path // "") != "" then $git.path else $cwd end) | basename) as $unnamed
        # Two signals, because neither covers the other. The session file is
        # exact but Herdr flushes it about five seconds after a rename, so it
        # cannot be what makes a rename show up; a label differing from the
        # basename covers those seconds, and the file covers a name that happens
        # to equal it. A space nobody named trips neither, its label being that
        # basename already.
        | (($named[$workspace.workspace_id] // false) or $label != $unnamed) as $chosen
        # A chosen label joins the name rather than replacing it: the repo says
        # where you are and the label says which of them this is. One that
        # already matches the name renders it once, so it is not worth a second
        # column.
        | if $chosen and $label != "" and $label != $where
          then "\($where) · \($label)"
          else $where
          end;

      # Sidebar order, so the numbers run top to bottom and closing or moving a
      # space renumbers the ones sharing its title. A number says which of these,
      # not which one; a space worth referring to is worth renaming.
      [.result.workspaces[] | { workspace: ., title: title_of(.) }]
      | (reduce .[] as $entry ({ seen: {}, out: [] };
          $entry.title as $t
          | (if $t == "" then 0 else (.seen[$t] // 0) + 1 end) as $n
          | (if $t == "" then . else .seen[$t] = $n end)
          | .out += [$entry | .title = (if $n > 1 then "\($t) \($n)" else $t end)]
        ) | .out)
      | .[]
      | .title as $title
      | .workspace as $workspace
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
              # Kind, not the agent name: names are long and usually repeat the
              # space label. It stands in only where there is no title to show.
              # Claude puts a spinner frame at the front of its title, and Herdr
              # does not count that as decoration to strip. Next to the state
              # mark it reads as a second, contradicting status glyph, so drop a
              # leading run of symbols. A bracketed prefix like [wip] survives:
              # the run has to reach whitespace without passing a letter first.
              ($pane.terminal_title_stripped // "" | sub("^[^\\p{L}\\p{N}]+\\s+"; "")) as $title
              | (if $title == "" then $pane.agent else $title end) as $what
              | ([$tab_labels[$pane.tab_id] // empty, $what] | join(" · ")) as $rest
              | ($pane.agent_status | mark) as $icon
              | if $pane.agent_status == "blocked" then
                  ["--token", "a\($slot)_blocked=\($icon) \($rest)"]
                  + clear_but($slot; ["a\($slot)_blocked"])
                elif $pane.agent_status == "done" then
                  # done is the same idle agent as below, only its work has not
                  # been seen yet. Focusing the tab, which splitting a pane does,
                  # turns one into the other, so the two have to read as the same
                  # line with a different glyph. Anything else makes an agent
                  # rename itself as you work beside it.
                  ["--token", "a\($slot)_done=\($icon) \($rest)"]
                  + clear_but($slot; ["a\($slot)_done"])
                else
                  ["--token", "a\($slot)=\($icon) \($rest)"]
                  + clear_but($slot; ["a\($slot)"])
                end
            end
        ]
        + [$mine[$slots:] as $hidden
           | if ($hidden | length) == 0 then
               ["--clear-token", "more", "--clear-token", "more_blocked"]
             else
               # The same glyphs the slots use, so the overflow line says what is
               # in it without spending the columns to spell the statuses out.
               ([$hidden[] | select(.agent_status == "blocked")] | length) as $blocked
               | ([$hidden[] | select(.agent_status == "done")] | length) as $done
               | ([
                   (if $blocked > 0 then "\($blocked)◆" else empty end),
                   (if $done > 0 then "\($done)✓" else empty end)
                 ] | join(" ")) as $flags
               | (if $flags == "" then "" else " · \($flags)" end) as $tail
               | "+\($hidden | length) more\($tail)" as $line
               # An agent folded into the count is still waiting on you, so the
               # overflow line takes the loud row a slot would have given it.
               | (if $blocked > 0 then
                    ["--token", "more_blocked=\($line)", "--clear-token", "more"]
                  else
                    ["--token", "more=\($line)", "--clear-token", "more_blocked"]
                  end)
             end]
      # One line per report rather than per space, because a space owns more
      # tokens than one report may carry. Each group above is a whole slot, and
      # groups are packed rather than sliced: the set and the clears for a slot
      # have to land in the same report, or between the two the sidebar draws the
      # new line and the leftover one together on the row they share.
      | reduce .[] as $group ([];
          if length == 0 or ((.[-1] | length) + ($group | length)) > ($batch * 2)
          then . + [$group]
          else .[0:-1] + [.[-1] + $group]
          end)
      | .[]
      | [$workspace.workspace_id] + .
      # One argument per line, then a blank line to end the report. An argument
      # holds spaces and a token value holds whatever an agent put in its title,
      # so nothing here may go back through word splitting or a quoting pass.
      | (.[], "")
    '
)"

printf '%s\n' "$plan" |
  {
    # Rebuild each report by appending a line at a time, which is the one way to
    # carry arguments with spaces through POSIX sh without re-parsing them. The
    # first is the space, matching the argument order the command already took.
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
