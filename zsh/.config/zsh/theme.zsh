__terminal_theme_root() {
  print -r -- "${XDG_CONFIG_HOME:-$HOME/.config}/tt"
}

__terminal_theme_apply_env() {
  local root
  root="$(__terminal_theme_root)"

  if [[ -r "$root/current" ]]; then
    export TERMINAL_THEME="$(<"$root/current")"
  else
    export TERMINAL_THEME="nightfox"
  fi
}

__terminal_theme_complete() {
  emulate -L zsh
  setopt local_options no_aliases

  local root themes_dir
  local -a themes
  root="$(__terminal_theme_root)"
  themes_dir="$root/themes"
  themes=("$themes_dir"/*(N:t))

  (( CURRENT == 2 )) || return 0

  compadd -a themes
}

# %x is this file, so the sibling resolves the same through the stow link or the
# repo.
tt() {
  local impl="${${(%):-%x}:A:h}/tt.zsh"

  if [[ ! -r "$impl" ]]; then
    print -u2 -- "tt: cannot read $impl"
    return 1
  fi

  unfunction tt
  source "$impl"
  tt "$@"
}

autoload -Uz compdef
compdef __terminal_theme_complete tt 2>/dev/null || true

__terminal_theme_apply_env
