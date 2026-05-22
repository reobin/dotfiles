__ssh_is_target_macos() {
  local arg
  for arg in "$@"; do
    [[ "$arg" == "macos" || "$arg" == *@macos ]] && return 0
  done
  return 1
}

term-olive-crt-dark() {
  # Runtime-only olive-crt-dark palette shift; reset with term-reset.
  printf '\033]10;#FBFCF6\033\\' # foreground
  printf '\033]11;#1D211A\033\\' # background
  printf '\033]12;#FBFCF7\033\\' # cursor
  printf '\033]17;#616B5C\033\\' # selection background
  printf '\033]19;#FBFCF6\033\\' # selection foreground
  printf '\033]4;0;#1D211A\033\\'
  printf '\033]4;1;#EA938B\033\\'
  printf '\033]4;2;#BCCD80\033\\'
  printf '\033]4;3;#F7C775\033\\'
  printf '\033]4;4;#90DDE4\033\\'
  printf '\033]4;5;#DAC3ED\033\\'
  printf '\033]4;6;#A5D6CB\033\\'
  printf '\033]4;7;#FBFCF6\033\\'
  printf '\033]4;8;#99A293\033\\'
  printf '\033]4;9;#EA938B\033\\'
  printf '\033]4;10;#ECF6AE\033\\'
  printf '\033]4;11;#FBE09F\033\\'
  printf '\033]4;12;#90DDE4\033\\'
  printf '\033]4;13;#DAC3ED\033\\'
  printf '\033]4;14;#A5D6CB\033\\'
  printf '\033]4;15;#FBFCF7\033\\'
}

term-reset() {
  printf '\033]110\033\\' # foreground
  printf '\033]111\033\\' # background
  printf '\033]112\033\\' # cursor
  printf '\033]117\033\\' # selection background
  printf '\033]119\033\\' # selection foreground
  printf '\033]104\033\\' # ansi palette
}

term-macos() {
  term-olive-crt-dark
}

ssh() {
  if __ssh_is_target_macos "$@"; then
    term-macos
    TERM=xterm-256color command ssh "$@"
    term-reset
  else
    command ssh "$@"
  fi
}
