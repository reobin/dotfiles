open() {
  command xdg-open "$@" >/dev/null 2>&1 & disown
}
