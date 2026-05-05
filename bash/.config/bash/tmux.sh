th() {
  local class="org.reobin.thudsh"
  local title="thud.sh"
  local width="${TH_WIDTH:-360}"
  local command_name command_path addr height i launch_command previous_addr active_workspace focus_addr
  local class_arg title_arg old_addr

  for command_name in ghostty hyprctl jq thud.sh; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      printf 'th: missing required command: %s\n' "$command_name" >&2
      return 1
    fi
  done

  previous_addr="$(hyprctl activewindow -j 2>/dev/null | jq -r '.address // empty')" || previous_addr=""
  active_workspace="$(hyprctl activeworkspace -j | jq -r '.id')" || return 1

  addr="$(set -o pipefail; hyprctl clients -j | jq -r --arg class "$class" '
    map(select(.class == $class or .title == "thud.sh" or .initialTitle == "thud.sh")) | first | .address // empty
  ')" || return 1

  if [[ -n "$addr" ]]; then
    old_addr="$addr"
    hyprctl dispatch closewindow "address:$addr" >/dev/null || return 1
    addr=""
  fi

  printf -v class_arg '%q' "$class"
  printf -v title_arg '%q' "$title"
  command_path="$(command -v thud.sh)" || return 1
  printf -v command_path '%q' "$command_path"
  launch_command="ghostty --gtk-single-instance=false --class=$class_arg --title=$title_arg --gtk-titlebar=false -e $command_path"

  hyprctl dispatch exec -- "$launch_command" >/dev/null || return 1

  for i in {1..50}; do
    addr="$(set -o pipefail; hyprctl clients -j | jq -r --arg class "$class" '
      map(select(.class == $class or .title == "thud.sh" or .initialTitle == "thud.sh")) | first | .address // empty
    ')" || return 1

    [[ -n "$addr" && "$addr" != "$old_addr" ]] && break
    sleep 0.05
  done

  if [[ -z "$addr" ]]; then
    printf 'th: timed out waiting for Ghostty window\n' >&2
    return 1
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

tl() {
  [[ -z $1 ]] && { echo "Usage: tl <ai>"; return 1; }
  [[ -z $TMUX ]] && { echo "You must start tmux to use tl."; return 1; }

  local current_dir="${PWD}"
  local editor_pane ai_pane
  local ai="$1"

  editor_pane="$TMUX_PANE"

  # split editor pane horizontally - AI on right 40%
  ai_pane=$(tmux split-window -h -p 40 -d -t "$editor_pane" -c "$current_dir" -P -F '#{pane_id}')

  tmux send-keys -t "$ai_pane" "$ai" C-m
  tmux select-pane -t "$ai_pane"
}

tmux_session_name_refresh() {
  [[ -z $TMUX ]] && return 0

  local session_id
  session_id=$(tmux display-message -p '#{session_id}' 2>/dev/null) || return 0
  ~/.config/tmux/tmux-session-name.sh "$session_id"
}

__tmux_refresh_name_on_pwd_change() {
  [[ -z $TMUX ]] && return 0

  if [[ "$PWD" == "$__tmux_last_pwd" ]]; then
    return 0
  fi
  __tmux_last_pwd="$PWD"

  local session_id
  session_id=$(tmux display-message -p '#{session_id}' 2>/dev/null) || return 0

  ~/.config/tmux/tmux-session-name.sh "$session_id"
}

if [[ -n $TMUX ]]; then
  if [[ ";$PROMPT_COMMAND;" != *";__tmux_refresh_name_on_pwd_change;"* ]]; then
    PROMPT_COMMAND="__tmux_refresh_name_on_pwd_change${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
  fi
fi
