__terminal_theme_root() {
  print -r -- "${XDG_CONFIG_HOME:-$HOME/.config}/terminal-theme"
}

__terminal_theme_apply_env() {
  local root
  root="$(__terminal_theme_root)"

  if [[ -r "$root/current" ]]; then
    export TERMINAL_THEME="$(<"$root/current")"
  else
    export TERMINAL_THEME="olive"
  fi
}

__terminal_theme_reload_ghostty() {
  [[ "${TERM_PROGRAM:-}" == "ghostty" ]] || return 1
  command -v osascript >/dev/null 2>&1 || return 1

  osascript >/dev/null 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  keystroke "," using {command down, shift down}
end tell
APPLESCRIPT
}

ttheme() {
  emulate -L zsh
  setopt local_options no_aliases

  local root themes_dir active_dir current_file theme
  root="$(__terminal_theme_root)"
  themes_dir="$root/themes"
  active_dir="$root/active"
  current_file="$root/current"
  theme="$1"

  if [[ "$theme" == "-l" || "$theme" == "--list" ]]; then
    print -rl -- "$themes_dir"/*(N:t)
    return 0
  fi

  if [[ "$theme" == "-c" || "$theme" == "--current" ]]; then
    [[ -r "$current_file" ]] && cat "$current_file" || print olive
    return 0
  fi

  if [[ -z "$theme" ]]; then
    local themes
    themes=("$themes_dir"/*(N:t))

    if (( ${#themes[@]} == 0 )); then
      print "No terminal themes found in $themes_dir"
      return 1
    fi

    if command -v fzf >/dev/null 2>&1; then
      theme="$(printf '%s\n' "${themes[@]}" | fzf --prompt='theme> ' --height=40% --reverse)"
    else
      print -rl -- "${themes[@]}"
      print -n "theme> "
      read -r theme
    fi
  fi

  [[ -n "$theme" ]] || return 1

  if [[ ! -d "$themes_dir/$theme" ]]; then
    print "Unknown terminal theme: $theme"
    print "Available themes:"
    print -rl -- "$themes_dir"/*(N:t)
    return 1
  fi

  local ghostty_config ghostty_theme ghostty_theme_dir tmp_config
  ghostty_config="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
  ghostty_theme="terminal-$theme"
  ghostty_theme_dir="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/themes"

  command mkdir -p "$active_dir"
  command cp -f "$themes_dir/$theme/ghostty.conf" "$active_dir/ghostty.conf"
  command mkdir -p "$ghostty_theme_dir"
  command cp -f "$themes_dir/$theme/ghostty.conf" "$ghostty_theme_dir/$ghostty_theme"
  command cp -f "$themes_dir/$theme/nvim.lua" "$active_dir/nvim.lua"
  command cp -f "$themes_dir/$theme/tmux.conf" "$active_dir/tmux.conf"
  print -r -- "$theme" > "$current_file"

  if [[ -w "$ghostty_config" ]]; then
    tmp_config="${ghostty_config}.tmp.$$"
    awk -v theme="$ghostty_theme" '
      BEGIN { changed = 0 }
      /^theme[[:space:]]*=/ {
        print "theme = " theme
        changed = 1
        next
      }
      { print }
      END {
        if (!changed) {
          print "theme = " theme
        }
      }
    ' "$ghostty_config" > "$tmp_config" && command mv -f "$tmp_config" "$ghostty_config"
  fi

  __terminal_theme_apply_env

  if command -v tmux >/dev/null 2>&1; then
    tmux source-file "$HOME/.config/tmux/tmux.conf" >/dev/null 2>&1 || true
  fi

  if command -v herdr >/dev/null 2>&1; then
    herdr server reload-config >/dev/null 2>&1 || true
  fi

  local ghostty_reloaded=0
  if __terminal_theme_reload_ghostty; then
    ghostty_reloaded=1
  fi

  print "terminal theme: $theme"

  if [[ "${TERM_PROGRAM:-}" == "ghostty" && "$ghostty_reloaded" != 1 ]]; then
    print "reload Ghostty with Cmd+Shift+,"
  fi
}

alias theme=ttheme
__terminal_theme_apply_env
