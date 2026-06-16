pathadd() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    PATH=":${PATH}:"
    PATH="${PATH//:${dir}:/:}"
    PATH="${dir}${PATH%:}"
    PATH="${PATH#:}"
  fi
}
