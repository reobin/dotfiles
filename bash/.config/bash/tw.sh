tw() {
  local class="org.reobin.twatch"
  local title="t.watch"
  local width="${TW_WIDTH:-360}"
  local command_name addr height i watch_dir launch_command previous_addr active_workspace focus_addr
  local class_arg title_arg watch_dir_arg

  for command_name in ghostty hyprctl jq; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      printf 'tw: missing required command: %s\n' "$command_name" >&2
      return 1
    fi
  done

  previous_addr="$(hyprctl activewindow -j 2>/dev/null | jq -r '.address // empty')" || previous_addr=""
  active_workspace="$(hyprctl activeworkspace -j | jq -r '.id')" || return 1

  addr="$(set -o pipefail; hyprctl clients -j | jq -r --arg class "$class" '
    map(select(.class == $class or .title == "t.watch" or .initialTitle == "t.watch" or .title == "bun start")) | first | .address // empty
  ')" || return 1

  if [[ -z "$addr" ]]; then
    watch_dir="${TWATCH_DIR:-$HOME/dev/t.watch}"
    printf -v class_arg '%q' "$class"
    printf -v title_arg '%q' "$title"
    printf -v watch_dir_arg '%q' "$watch_dir"
    launch_command="env TWATCH_DIR=$watch_dir_arg ghostty --gtk-single-instance=false --class=$class_arg --title=$title_arg --gtk-titlebar=false -e bash -lc 'set -euo pipefail; watch_dir=\"\${TWATCH_DIR:-\$HOME/dev/t.watch}\"; if [[ -d \"\$watch_dir\" ]]; then cd \"\$watch_dir\"; exec bun run start; fi; exec t.watch'"

    hyprctl dispatch exec -- "$launch_command" >/dev/null || return 1

    for i in {1..50}; do
      addr="$(set -o pipefail; hyprctl clients -j | jq -r --arg class "$class" '
        map(select(.class == $class or .title == "t.watch" or .initialTitle == "t.watch" or .title == "bun start")) | first | .address // empty
      ')" || return 1

      [[ -n "$addr" ]] && break
      sleep 0.05
    done

    if [[ -z "$addr" ]]; then
      printf 'tw: timed out waiting for Ghostty window\n' >&2
      return 1
    fi
  fi

  hyprctl -q --batch \
    "dispatch focuswindow address:$addr;" \
    "dispatch settiled address:$addr;" \
    "dispatch swapwindow l;"

  height="$(set -o pipefail; hyprctl clients -j | jq -r --arg addr "$addr" '
    map(select(.address == $addr)) | first | .size[1] // empty
  ')" || return 1

  [[ -n "$height" ]] || return 1

  hyprctl dispatch resizewindowpixel "exact $width $height,address:$addr" >/dev/null

  focus_addr="$previous_addr"
  if [[ -z "$focus_addr" || "$focus_addr" == "$addr" ]]; then
    focus_addr="$(set -o pipefail; hyprctl clients -j | jq -r --arg addr "$addr" --argjson workspace "$active_workspace" '
      map(select(.address != $addr and .workspace.id == $workspace and .mapped and (.hidden | not)))
      | sort_by(.focusHistoryID)
      | first
      | .address // empty
    ')" || return 1
  fi

  if [[ -n "$focus_addr" ]]; then
    hyprctl dispatch focuswindow "address:$focus_addr" >/dev/null
  fi
}
