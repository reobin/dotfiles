pathadd() {
  local dir="$1"
  if [[ -d "$dir" && ":$PATH:" != *":$dir:"* ]]; then
    PATH="${dir}${PATH:+":$PATH"}"
  fi
}
