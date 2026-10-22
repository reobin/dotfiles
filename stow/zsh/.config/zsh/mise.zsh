mupb() {
  local specs
  specs=$(mise ls --json | jq -r 'to_entries[] | .key as $t | .value[] | select(.active) | (.requested_version // .version) as $v | select($v | startswith("branch:")) | "\($t)@\($v)"')
  if [[ -z "$specs" ]]; then
    echo "mupb: no branch-pinned tools"
    return 0
  fi
  echo "$specs" | while IFS= read -r spec; do
    mise install --force "$spec"
  done
}
