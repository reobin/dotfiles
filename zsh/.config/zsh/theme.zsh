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

__terminal_theme_rgb() {
  emulate -L zsh
  setopt local_options no_aliases

  local hex="$1"
  [[ "$hex" == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]] || return 1

  local -u body="${hex#\#}"
  printf '%d;%d;%d' "$((16#${body[1,2]}))" "$((16#${body[3,4]}))" "$((16#${body[5,6]}))"
}

__terminal_theme_color_block() {
  emulate -L zsh
  setopt local_options no_aliases

  local label="$1" hex="$2" bg="$3" fg="$4" rgb text cols visible pad
  rgb="$(__terminal_theme_rgb "$hex")" || return
  __terminal_theme_rgb "$bg" >/dev/null || return
  __terminal_theme_rgb "$fg" >/dev/null || return

  text="$(printf ' %-22s %s' "$label" "$hex")"
  cols="$(__terminal_theme_preview_columns)"
  visible=$((4 + ${#text}))
  pad=$((cols - visible))
  (( pad < 0 )) && pad=0

  __terminal_theme_style "$bg" "$fg"
  printf '\033[48;2;%sm    ' "$rgb"
  __terminal_theme_style "$bg" "$fg"
  printf '%s%*s\033[0m\n' "$text" "$pad" ''
}

__terminal_theme_preview_columns() {
  emulate -L zsh
  setopt local_options no_aliases

  local cols="${FZF_PREVIEW_COLUMNS:-${COLUMNS:-80}}"
  [[ "$cols" == <-> ]] || cols=80
  (( cols > 0 )) || cols=80
  print -r -- "$cols"
}

__terminal_theme_style() {
  emulate -L zsh
  setopt local_options no_aliases

  local bg="$1" fg="$2" bg_rgb fg_rgb
  bg_rgb="$(__terminal_theme_rgb "$bg")" || return
  fg_rgb="$(__terminal_theme_rgb "$fg")" || return

  printf '\033[48;2;%sm\033[38;2;%sm' "$bg_rgb" "$fg_rgb"
}

__terminal_theme_line() {
  emulate -L zsh
  setopt local_options no_aliases

  local bg="$1" fg="$2" text="$3" visible="${4:-${#3}}" cols pad
  cols="$(__terminal_theme_preview_columns)"
  pad=$((cols - visible))
  (( pad < 0 )) && pad=0

  __terminal_theme_style "$bg" "$fg"
  printf '%s%*s\033[0m\n' "$text" "$pad" ''
}

__terminal_theme_preview() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" ghostty_file theme line name i bg fg accent selection_bg selection_fg
  local -A color palette
  ghostty_file="$theme_dir/ghostty.conf"
  theme="${theme_dir:t}"

  if [[ -r "$ghostty_file" ]]; then
    while IFS= read -r line; do
      if [[ "$line" =~ '^palette[[:space:]]*=[[:space:]]*([0-9]+)=(#[0-9A-Fa-f]{6})' ]]; then
        palette[$match[1]]="$match[2]"
      elif [[ "$line" =~ '^([[:alpha:]-]+)[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})' ]]; then
        color[$match[1]]="$match[2]"
      fi
    done < "$ghostty_file"
  fi

  bg="${color[background]:-${palette[0]:-#000000}}"
  fg="${color[foreground]:-${palette[7]:-#ffffff}}"
  muted="${palette[8]:-$fg}"
  accent="${palette[12]:-${palette[4]:-$fg}}"
  selection_bg="${color[selection-background]:-${palette[8]:-$bg}}"
  selection_fg="${color[selection-foreground]:-$fg}"

  __terminal_theme_line "$selection_bg" "$selection_fg" " $theme "
  __terminal_theme_line "$bg" "$fg" ""

  __terminal_theme_line "$bg" "$accent" "surface"
  for name in background foreground cursor-color selection-background selection-foreground; do
    [[ -n "${color[$name]:-}" ]] && __terminal_theme_color_block "$name" "${color[$name]}" "$bg" "$fg"
  done
  __terminal_theme_line "$bg" "$fg" ""

  __terminal_theme_line "$bg" "$accent" "ansi"
  for i in {0..7}; do
    [[ -n "${palette[$i]:-}" ]] && __terminal_theme_color_block "palette $i" "${palette[$i]}" "$bg" "$fg"
  done
  __terminal_theme_line "$bg" "$fg" ""

  __terminal_theme_line "$bg" "$accent" "bright"
  for i in {8..15}; do
    [[ -n "${palette[$i]:-}" ]] && __terminal_theme_color_block "palette $i" "${palette[$i]}" "$bg" "$fg"
  done
}

__terminal_theme_select() {
  local themes_dir theme preview_source preview_cmd
  themes_dir="$1"

  if command -v fzf >/dev/null 2>&1; then
    preview_source="${functions_source[__terminal_theme_preview]}"
    preview_cmd="zsh -fc 'source \"\$1\" && __terminal_theme_preview \"\$2\"' _ ${(q)preview_source} ${(q)themes_dir}/{}"

    print -rl -- "$themes_dir"/*(N:t) | fzf \
      --prompt='theme> ' \
      --height=60% \
      --reverse \
      --cycle \
      --no-multi \
      --bind='enter:accept' \
      --preview="$preview_cmd"
    return
  fi

  print -rl -- "$themes_dir"/*(N:t)
  print -n "theme> "
  read -r theme
  print -r -- "$theme"
}

__terminal_theme_complete() {
  emulate -L zsh
  setopt local_options no_aliases

  local root themes_dir
  local -a themes opts
  root="$(__terminal_theme_root)"
  themes_dir="$root/themes"
  themes=("$themes_dir"/*(N:t))
  opts=(-c --current)

  (( CURRENT == 2 )) || return 0

  if [[ "$PREFIX" == -* ]]; then
    compadd -a opts
  else
    compadd -a themes
  fi
}

tt() {
  emulate -L zsh
  setopt local_options no_aliases

  local root themes_dir active_dir current_file theme
  root="$(__terminal_theme_root)"
  themes_dir="$root/themes"
  active_dir="$root/active"
  current_file="$root/current"
  theme="$1"

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

    theme="$(__terminal_theme_select "$themes_dir")"
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

autoload -Uz compdef
compdef __terminal_theme_complete tt 2>/dev/null || true

__terminal_theme_apply_env
