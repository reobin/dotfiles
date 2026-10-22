__zsh_restore_cursor() {
  printf '\e[4 q'
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __zsh_restore_cursor
