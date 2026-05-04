th() {
  local width="${TH_WIDTH:-240}"

  if [[ ! "$width" =~ '^[0-9]+$' ]]; then
    print "th: TH_WIDTH must be a number" >&2
    return 1
  fi

  /usr/bin/open "hammerspoon://thud?width=$width"
}
