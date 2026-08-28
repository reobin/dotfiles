#!/bin/sh

# Report one sidebar line per pane onto each Herdr space.
#
# A space row can only render workspace-level values, so the per-pane lines live
# here: this turns the session snapshot into workspace metadata tokens, and
# [ui.sidebar.spaces] in config.toml decides where those tokens go.
#
# Usage: refresh.sh         report the current panes
#        refresh.sh clear    remove every token this script owns
#
# This runs on every event in herdr-plugin.toml, so the cost that matters is
# process spawns and not compute: one call per kind of question rather than one
# per workspace or per file, and nothing written that Herdr already has.

set -eu

herdr="${HERDR_BIN_PATH:-herdr}"
source_id="space-tokens"
# [ui.sidebar.spaces] has room for 13. Past that the config goes over Herdr's row
# cap, which it answers by discarding the file and using defaults.
slots=6
processes=1

# Herdr's per-report token cap. Going over fails the whole report, and the only
# place that surfaces is `herdr plugin logs list`: the rows just stop changing.
batch=16

# One writer at a time. Every run recomputes every space from a snapshot it takes
# at its own start, so two that overlap can finish out of order and leave the
# older one's rows behind. A run that finds the lock held leaves a mark instead of
# waiting, and the holder picks it up and goes again, so the last request is still
# the one that lands.
state_dir="${XDG_CACHE_HOME:-$HOME/.cache}/herdr/space-tokens"
lock_dir="$state_dir/lock"
pending_file="$state_dir/pending"
mkdir -p "$state_dir"

# Set by the rerun at the bottom, which is handed the lock rather than taking it.
if [ "${HERDR_SPACE_TOKENS_LOCKED:-}" != 1 ]; then
  [ "${1:-}" = "clear" ] || : >"$pending_file"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    # A run killed outright leaves the directory behind, and without this nothing
    # would move a row again. No refresh takes a minute.
    if [ -n "$(find "$lock_dir" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
      rmdir "$lock_dir" 2>/dev/null || :
    fi
    mkdir "$lock_dir" 2>/dev/null || exit 0
  fi
fi
trap 'rmdir "$lock_dir" 2>/dev/null || :' EXIT

# Consumed before the snapshot below, so a request arriving while this run works
# marks it again rather than being answered by a snapshot taken before it.
[ "${1:-}" = "clear" ] || rm -f "$pending_file"

# Workspaces, tabs, panes and the tokens already set, in one call and at one
# instant: separate lists could disagree about a pane that moved between them.
snapshot="$("$herdr" api snapshot)"

# Everything the shell has to loop over, in one jq pass. The prefixes are split
# back apart by the `case` below, which is a builtin and free.
lists="$(
  printf '%s' "$snapshot" |
    jq -r '
      .result.snapshot as $s
      | ($s.workspaces[] | "ws \(.workspace_id)"),
        ($s.panes[] | select(.agent == null) | "cmd \(.pane_id)"),
        ($s.panes[]
          | select(.agent_status == "done" or .agent_status == "idle")
          | select((.agent_session.kind // "") == "id")
          | "task \(.pane_id) \(.agent_session.value)")
    '
)"

ws_ids=""
cmd_panes=""
task_pairs=""
while IFS=' ' read -r kind first second; do
  case "$kind" in
    ws) ws_ids="$ws_ids $first" ;;
    cmd) cmd_panes="$cmd_panes $first" ;;
    task) task_pairs="$task_pairs$first $second
" ;;
  esac
done <<EOF
$lists
EOF

if [ "${1:-}" = "clear" ]; then
  names=""
  slot=1
  while [ "$slot" -le "$slots" ]; do
    names="$names a$slot a${slot}_blocked a${slot}_working a${slot}_done a${slot}_pane"
    slot=$((slot + 1))
  done
  names="$names more more_blocked title"

  # Ids and token names carry no whitespace, so splitting the lists on it is safe.
  # shellcheck disable=SC2086
  for workspace in $ws_ids; do
    args=""
    count=0
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

# The checkout each space is open on, which the title row needs below. The
# snapshot does not carry it, and this call is the whole cost of the script:
# 60-80ms of real git work per space, where everything else here is under 10ms.
# One reply lists every worktree in the repo with the space that has it open, so
# recording the spaces it names turns a call per space into a call per repo. A
# space outside a repo is named by no reply and still costs one each: it answers
# with an error, `null` stands in for that, and jq reads it as no repo.
#
# Ids and replies are streamed in turn and merged in a single jq, rather than
# reducing into the map one spawn at a time.
sibling_filter='[.result.worktrees[]?.open_workspace_id | select(. != null)] | join("|")'
repos='{}'
if [ -n "$ws_ids" ]; then
  repos="$(
    {
      answered="|"
      # shellcheck disable=SC2086
      for workspace in $ws_ids; do
        # The leading paren is not optional: without it the one that closes the
        # pattern reads as the end of the command substitution this sits in.
        case "$answered" in
          (*"|$workspace|"*) continue ;;
        esac
        info="$("$herdr" worktree list --workspace "$workspace" 2>/dev/null)" || info=null
        [ -n "$info" ] || info=null
        printf '"%s"\n%s\n' "$workspace" "$info"
        answered="$answered$workspace|"
        siblings="$(printf '%s' "$info" | jq -r "$sibling_filter" 2>/dev/null)" || siblings=""
        [ -z "$siblings" ] || answered="$answered$siblings|"
      done
    } |
      jq -sc '
        . as $in
        | reduce range(0; ($in | length) / 2) as $i ({};
            $in[$i * 2] as $queried
            | (($in[$i * 2 + 1] // {}).result // {}) as $result
            | ($result.source.repo_name // "") as $repo
            | if $repo == "" then .
              else
                reduce (($result.worktrees // [])[]
                        | select(.open_workspace_id != null)) as $wt (.;
                  . + { ($wt.open_workspace_id): { name: $repo, path: $wt.path } })
                # A space open on the bare repo rather than one of its worktrees
                # is named by no entry, so it takes the root.
                | if has($queried) then .
                  else . + { ($queried): { name: $repo, path: ($result.source.repo_root // "") } }
                  end
              end)
      '
  )" || repos='{}'
fi

# Which spaces someone has named. The socket cannot say: custom name and checkout
# basename come back in the same field, so a space named after its own checkout is
# invisible there. This is Herdr's state file and not an API, so a changed shape or
# a missing file falls back to {} and leaves only the label comparison below.
session_file="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/session.json"
named='{}'
if [ -s "$session_file" ] && [ -r "$session_file" ]; then
  named="$(
    jq -c '[.workspaces[]? | select(.custom_name != null) | { key: .id, value: true }] | from_entries' \
      "$session_file" 2>/dev/null
  )" || named='{}'
fi

# What each pane is running. The process group leader is the command that was
# typed, so `pnpm start` reads as `pnpm start` rather than the node process it
# became, and a pane sitting at a prompt reads as `shell`. The preexec and precmd
# hooks in zsh/.config/zsh/herdr.zsh are what run this script on either side of a
# command, so the row follows one starting and ending.
commands='{}'
if [ "$processes" -eq 1 ] && [ -n "$cmd_panes" ]; then
  commands="$(
    {
      # shellcheck disable=SC2086
      for pane in $cmd_panes; do
        info="$("$herdr" pane process-info --pane "$pane" 2>/dev/null)" || info=null
        [ -n "$info" ] || info=null
        printf '"%s"\n%s\n' "$pane" "$info"
      done
    } |
      jq -sc '
        . as $in
        | reduce range(0; ($in | length) / 2) as $i ({};
            $in[$i * 2] as $pane
            | (($in[$i * 2 + 1] // {}).result.process_info // {}) as $info
            | ($info.foreground_processes // []) as $running
            | (($running | map(select(.pid == $info.foreground_process_group_id)) | first)
               // ($running | last)) as $leader
            | (if $leader == null then
                 "shell"
               else
                 (($leader.argv0 // $leader.name // "shell") | split("/") | last) as $command
                 | [$command] + (($leader.argv // [])[1:2]) | join(" ")
               end) as $label
            | . + { ($pane): $label })
      '
  )" || commands='{}'
fi

# A Claude turn ends while the work it started keeps running, so the pane goes
# idle and the row calls it done. Every background task gets a file at
# <session>/tasks/<id>.output, and every one that ends is announced back into the
# transcript as <task-id>: a file with no announcement is still running. Some ends
# leave no marker at all -- a Monitor timing out, a task stopped from the UI -- so
# a file untouched for $stale_after seconds is read as one of those rather than
# believed forever.
stale_after=1800
cutoff=""
task_dirs=""
transcripts=""
pending_pairs=""
if [ -n "$task_pairs" ]; then
  # BSD spelling first, GNU second: each rejects the other option outright.
  cutoff="$(
    date -v-${stale_after}S '+%Y-%m-%d %H:%M:%S' 2>/dev/null ||
      date -d "-$stale_after seconds" '+%Y-%m-%d %H:%M:%S'
  )"

  # Walked once here rather than globbed per pane, and behind the guard above, so
  # a session with no finished agent touches the filesystem not at all. A base with
  # no claude directory leaves its glob unexpanded, which find reports and nothing
  # here needs.
  #
  # Depth 3 from a claude-* directory is <project>/<session>/tasks, and getting it
  # wrong is silent: too shallow matches nothing and every pending count reads zero.
  #
  # /private/tmp is left out beside /tmp: on macOS it is the same directory through
  # a symlink, so naming both walks every tasks dir twice, and on Linux /tmp is the
  # real path.
  task_dirs="$(
    find "${TMPDIR:-/tmp}"/claude-* /tmp/claude-* \
      -maxdepth 3 -type d -name tasks 2>/dev/null || true
  )"
  transcripts="$(find "$HOME/.claude/projects" -maxdepth 2 -name '*.jsonl' 2>/dev/null || true)"
fi

while IFS=' ' read -r pane session; do
  [ -n "$session" ] || continue

  tasks=""
  while IFS= read -r dir; do
    case "$dir" in
      */"$session"/tasks) tasks="$dir"; break ;;
    esac
  done <<EOF
$task_dirs
EOF
  [ -n "$tasks" ] || continue

  # A path at a time and not a split on whitespace: the project directory carries
  # the session cwd, so a checkout with a space would arrive as two ids and count
  # twice. Task ids hold no whitespace, which is why splitting $fresh below stays
  # safe. A here-doc and not a pipe, or the loop runs in a subshell and $fresh does
  # not survive it.
  #
  # -L because these are mostly symlinks into the subagent transcript they report
  # on: the link mtime is fixed at creation while the transcript keeps being
  # written, so reading the link would age out a subagent still working, which is
  # the case this block exists for.
  fresh=""
  while IFS= read -r output; do
    [ -n "$output" ] || continue
    id="${output##*/}"
    fresh="$fresh${fresh:+ }${id%.output}"
  done <<EOF
$(find -L "$tasks" -maxdepth 1 -type f -name '*.output' -newermt "$cutoff" 2>/dev/null)
EOF
  [ -n "$fresh" ] || continue

  transcript=""
  while IFS= read -r candidate; do
    case "$candidate" in
      */"$session.jsonl")
        # Keep looking when the name matches but the file cannot be read, rather
        # than stopping on the name alone and reporting no transcript at all.
        if [ -r "$candidate" ]; then
          transcript="$candidate"
          break
        fi
        ;;
    esac
  done <<EOF
$transcripts
EOF

  # Delimited so the test below is a `case` and not a `grep` per id, and so an id
  # that is a prefix of another cannot answer for it.
  announced="|"
  if [ -n "$transcript" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      announced="$announced${line#<task-id>}|"
    done <<EOF
$(
      # Task ids carry no whitespace, so splitting the list on it is safe.
      # shellcheck disable=SC2086
      printf '<task-id>%s\n' $fresh | grep -o -F -f - "$transcript" 2>/dev/null
    )
EOF
  fi

  count=0
  # shellcheck disable=SC2086
  for id in $fresh; do
    case "$announced" in
      *"|$id|"*) continue ;;
    esac
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || continue

  pending_pairs="$pending_pairs$pane $count
"
done <<EOF
$task_pairs
EOF

# Each map falls back to {} rather than letting `set -e` end the run: repos and
# commands pair an id with its reply by position, so a reply carrying anything but
# one JSON value shifts every pair after it and aborts jq. Partial cover -- a shift
# can also answer for the wrong id, which reads as a wrong title -- but it catches
# what would otherwise stop the run.
pending='{}'
if [ -n "$pending_pairs" ]; then
  pending="$(
    printf '%s' "$pending_pairs" |
      jq -Rsc 'split("\n") | map(select(. != "") | split(" "))
               | map({ key: .[0], value: (.[1] | tonumber) }) | from_entries'
  )" || pending='{}'
fi

# A `||` above only catches a jq that failed. jq also succeeds and prints nothing
# on an empty input, and that empty string reaches --argjson as a parse error which
# ends the run with nothing written, freezing every row until a later event happens
# to fix it. An empty map costs one worse title on one pass instead.
[ -n "$repos" ] || repos='{}'
[ -n "$named" ] || named='{}'
[ -n "$commands" ] || commands='{}'
[ -n "$pending" ] || pending='{}'

plan="$(
  printf '%s' "$snapshot" |
    jq -r --argjson commands "$commands" --argjson slots "$slots" \
      --argjson repos "$repos" --argjson named "$named" --argjson pending "$pending" \
      --argjson batch "$batch" '
      def mark:
        if . == "blocked" or . == "working" or . == "done" then "●"
        elif . == "idle" then "○"
        else "·"
        end;

      # The +N more row carries one color for all three states, so there the shape
      # is the only thing telling them apart.
      def tally:
        if . == "blocked" then "×"
        elif . == "done" then "✓"
        else mark
        end;

      def basename: (. / "/") | map(select(. != "")) | last // "";

      # Rows are static, so the color is chosen by which token carries a value:
      # set one and clear the rest, or the row renders both joined by " · ".
      def slots_of($slot): ["a\($slot)", "a\($slot)_blocked", "a\($slot)_working", "a\($slot)_done",
                            "a\($slot)_pane"];
      def clear_but($slot; $keep):
        [slots_of($slot)[] | select(IN($keep[]) | not) | ("--clear-token", .)];

      # Herdr stores a trimmed, control-stripped, 80-character truncation, and keeps
      # a value left empty by that as no token at all. The comparison below is
      # against what came back out, so it has to ask for the same shape: a raw
      # string would never match a row past 80 characters, and that space would then
      # report on every single run.
      def stored_form:
        sub("^\\s+"; "") | sub("\\s+$"; "")
        | gsub("\\p{Cc}"; "")
        | .[0:80]
        | sub("^\\s+"; "") | sub("\\s+$"; "")
        | if . == "" then null else . end;

      # Whether a group would move anything, against the tokens the space already
      # carries. Per group and not per token: a group is one row, and its set and
      # its clears have to travel together or the sidebar draws the new line and the
      # leftover one side by side.
      def group_changes($current):
        . as $group
        | [range(0; $group | length; 2) as $i
           | $group[$i] as $flag
           | $group[$i + 1] as $arg
           | if $flag == "--token"
             then ($arg | index("=")) as $eq
               | ($current[$arg[0:$eq]] // null) != ($arg[$eq + 1:] | stored_form)
             else ($current[$arg] // null) != null
             end]
        | any;

      .result.snapshot as $s
      # Only where a space has more than one tab: every tab carries a label and a
      # single-tab space labels it "1", which would staple a "1 · " to every row in
      # the sidebar. Keyed by space and not flattened by tab id, so a single-tab
      # space can never pick up a label through an id that belongs elsewhere. `// []`
      # so an older Herdr reporting no tabs loses the labels rather than aborting.
      | ([$s.workspaces[] | select(.tab_count > 1) | .workspace_id] | INDEX(.)) as $multi_tab
      | (($s.tabs // [])
         | map(select($multi_tab[.workspace_id]))
         | group_by(.workspace_id)
         | map({ key: .[0].workspace_id,
                 value: (map({ key: .tab_id, value: .label }) | from_entries) })
         | from_entries) as $tab_labels_by_ws

      | def title_of($workspace):
          ($s.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
          | ($repos[$workspace.workspace_id] // {}) as $git
          | ($git.name // "") as $repo
          | ($mine[0].cwd // "") as $cwd
          | ($workspace.label // "") as $label
          | ([$repo, ($cwd | basename), $label] | map(select(. != "")) | first // "") as $where
          # For about half a second after a cd the label is the basename of the
          # directory itself. Both spellings count as unnamed, or a refresh landing
          # in that window takes the difference for a name.
          | [((if ($git.path // "") != "" then $git.path else $cwd end) | basename),
             ($cwd | basename)] as $unnamed
          # Two signals: the session file is exact but Herdr flushes it seconds after
          # a rename, and a label unlike the basename covers those seconds.
          | (($named[$workspace.workspace_id] // false)
             or ($unnamed | index($label)) == null) as $chosen
          | if $chosen and $label != "" and $label != $where
            then "\($where) · \($label)"
            else $where
            end;

      $s.workspaces[]
      | . as $workspace
      | title_of(.) as $title
      | ($s.panes | map(select(.workspace_id == $workspace.workspace_id))) as $mine
      | ($tab_labels_by_ws[$workspace.workspace_id] // {}) as $tab_labels
      # Absent and null both mean no tokens yet. The type test is for anything else:
      # indexing a non-object aborts jq and writes nothing, and reporting everything
      # is the right way to be wrong here.
      | (if ($workspace.tokens | type) == "object" then $workspace.tokens else {} end) as $current
      | [if $title == "" then ["--clear-token", "title"] else ["--token", "title=\($title | stored_form // "")"] end]
      + [
          range(1; $slots + 1) as $slot
          | ($mine[$slot - 1]) as $pane
          | if $pane == null then
              clear_but($slot; [])
            elif ($pane.agent // null) == null then
              # A pane that names itself beats the process behind it: the hunk review
              # pane sets a title, where its leader reads as `node <entrypoint path>`.
              (($pane.title // "" | select(. != "")) // $commands[$pane.pane_id] // "shell") as $what
              | ([$tab_labels[$pane.tab_id] // empty, $what] | join(" · ")) as $rest
              # Its own token, so a pane row and an agent row Herdr has no status
              # for stay separable even though both render plain.
              | ["--token", "a\($slot)_pane=\("· \($rest)" | stored_form // "")"] + clear_but($slot; ["a\($slot)_pane"])
            else
              # Claude prefixes its title with a spinner frame, which reads as a
              # second status glyph contradicting the mark. Only a leading run of
              # symbols reaching whitespace goes, which spares a prefix like [wip].
              ($pane.terminal_title_stripped // "" | sub("^[^\\p{L}\\p{N}]+\\s+"; "")) as $title
              | (if $title == "" then $pane.agent else $title end) as $what
              | ([$tab_labels[$pane.tab_id] // empty, $what] | join(" · ")) as $rest
              | ($pending[$pane.pane_id] // 0) as $waiting
              # The count rides on the glyph, not the end of the line, which is a
              # title and gets truncated. One task is what the glyph already means, so
              # only a second is worth the column. It leads because a fallback glyph
              # can overrun its cell, and a separator space is safe to overrun.
              | (if $waiting > 1 then "\($waiting)\("working" | mark)"
                 elif $waiting == 1 then ("working" | mark)
                 else ($pane.agent_status | mark)
                 end) as $icon
              # idle is done-and-seen: it keeps the calm color and only drops from ●
              # to ○, which is what Herdr does on the space row above. That leaves
              # `a$slot` for `unknown`, a · in the plain foreground like a pane row.
              | (if $pane.agent_status == "blocked" then "a\($slot)_blocked"
                 elif $waiting > 0 or $pane.agent_status == "working" then "a\($slot)_working"
                 elif $pane.agent_status == "done" or $pane.agent_status == "idle"
                 then "a\($slot)_done"
                 else "a\($slot)"
                 end) as $slot_token
              | ["--token", "\($slot_token)=\("\($icon) \($rest)" | stored_form // "")"]
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
               | ([$hidden[] | select(.agent_status == "done" or .agent_status == "idle")
                             | select(($pending[.pane_id] // 0) == 0)] | length) as $done
               | ([
                   (if $blocked > 0 then "\($blocked)\("blocked" | tally)" else empty end),
                   (if $waiting > 0 then "\($waiting)\("working" | tally)" else empty end),
                   (if $done > 0 then "\($done)\("done" | tally)" else empty end)
                 ] | join(" ")) as $flags
               | (if $flags == "" then "" else " · \($flags)" end) as $tail
               | "+\($hidden | length) more\($tail)" as $line
               | (if $blocked > 0 then
                    ["--token", "more_blocked=\($line | stored_form // "")", "--clear-token", "more"]
                  else
                    ["--token", "more=\($line | stored_form // "")", "--clear-token", "more_blocked"]
                  end)
             end]
      # Only the rows that would move: a space reading the same as last time drops
      # out and costs no call, which is the common case.
      #
      # Tokens on a space are one flat map and not scoped per reporting source, so
      # this reads back every source. That is what makes the comparison right -- it
      # is the same map the sidebar renders from -- and also why the 33 names above
      # have to stay ours alone: another source setting one of them to the value
      # this run wanted would be taken for a write that already landed.
      #
      # No apostrophes in these comments: the whole program is one single-quoted
      # shell word, and one would end it.
      | map(select(group_changes($current)))
      # One line per report and not per space, because a space owns more tokens than
      # one report may carry. Packed and not sliced: a slot set and its clears have
      # to land in the same report, or between the two the sidebar draws the new
      # line and the leftover one together on the row they share.
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

# Two newlines: a report is flushed by the blank line after it, and the command
# substitution above stripped the last one. A space emits one report, so losing
# that line drops its whole row.
printf '%s\n\n' "$plan" |
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

# A request that arrived while this run was working. The lock passes to the rerun
# rather than being released, so nothing slips in between.
if [ -e "$pending_file" ]; then
  trap - EXIT
  HERDR_SPACE_TOKENS_LOCKED=1
  export HERDR_SPACE_TOKENS_LOCKED
  exec sh "$0"
fi
