path_contains() {
  [[ -n "$1" ]] || return 1
  case ":$PATH:" in
    *":$1:"*) return 0 ;;
    *) return 1 ;;
  esac
}

path_prepend() {
  [[ -n "$1" ]] || return 0
  path_contains "$1" || export PATH="$1:$PATH"
}

path_append() {
  [[ -n "$1" ]] || return 0
  path_contains "$1" || export PATH="$PATH:$1"
}
