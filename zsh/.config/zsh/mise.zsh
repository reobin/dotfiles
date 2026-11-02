mupp() {
  local specs
  if (( $# )); then
    specs=$(printf '%s\n' "$@")
  else
    specs=$(mise ls --json | jq -r 'to_entries[] | .key as $t | .value[] | select(.active) | (.requested_version // .version) as $v | select($v | startswith("branch:")) | "\($t)@\($v)"')
  fi
  if [[ -z "$specs" ]]; then
    echo "mupp: no branch-pinned tools"
    return 0
  fi
  echo "$specs" | while IFS= read -r spec; do
    [[ -n "$spec" ]] || continue
    mise install --force "$spec" || return 1
  done
}
