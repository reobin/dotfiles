hl() {
  [[ -z $1 ]] && { echo "Usage: hl <command>"; return 1; }
  command -v herdr >/dev/null 2>&1 || { echo "herdr is not installed."; return 1; }
  command -v jq >/dev/null 2>&1 || { echo "jq is required to use hl."; return 1; }

  local current_pane current_dir split_result new_pane

  current_pane=$(herdr pane list |
    jq -r '.result.panes[] | select(.focused == true) | .pane_id' |
    head -n 1)

  [[ -n $current_pane ]] || { echo "No focused herdr pane found."; return 1; }

  current_dir=$(herdr pane list |
    jq -r '.result.panes[] | select(.focused == true) | .foreground_cwd // .cwd' |
    head -n 1)

  split_result=$(herdr pane split "$current_pane" --direction right --cwd "$current_dir" --focus)
  new_pane=$(printf '%s\n' "$split_result" |
    jq -r '.result.pane_id // .result.pane.pane_id // .result.panes[-1].pane_id // empty')

  [[ -n $new_pane ]] || { echo "Could not create herdr pane."; return 1; }

  herdr pane run "$new_pane" "$*"
}
