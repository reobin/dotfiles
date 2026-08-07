__terminal_theme_root() {
  print -r -- "${XDG_CONFIG_HOME:-$HOME/.config}/tt"
}

# Herdr allows one `[theme.custom]` block, but `overlay0` has to be recessive
# against the active background and no single gray is recessive on both paper
# and ink. So the block lives per theme and gets concatenated onto the base
# config here. The result is config.toml, Herdr's own default path, so a
# running server picks it up on reload without needing a restart.
__terminal_theme_apply_herdr() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" herdr_dir tmp
  herdr_dir="${XDG_CONFIG_HOME:-$HOME/.config}/herdr"

  [[ -r "$herdr_dir/config.base.toml" ]] || return 1
  [[ -r "$theme_dir/herdr.toml" ]] || return 1

  tmp="$herdr_dir/config.toml.tmp.$$"

  # `return` from inside the group would exit the function past the cleanup and
  # strand the temp file, and herdr_dir is a stow symlink back into the dotfiles
  # repo, so chain on && and let the group's own status reach the cleanup.
  {
    command cat "$herdr_dir/config.base.toml" &&
      print &&
      print -r -- "# appended by tt from tt/themes/${theme_dir:t}/herdr.toml" &&
      command cat "$theme_dir/herdr.toml"
  } > "$tmp" || { command rm -f "$tmp"; return 1 }

  command mv -f "$tmp" "$herdr_dir/config.toml" || { command rm -f "$tmp"; return 1 }
}

__terminal_theme_apply_env() {
  local root
  root="$(__terminal_theme_root)"

  if [[ -r "$root/current" ]]; then
    export TERMINAL_THEME="$(<"$root/current")"
  else
    export TERMINAL_THEME="carbonfox"
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

__terminal_theme_background() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" line

  [[ -r "$theme_dir/ghostty.conf" ]] || return 1

  while IFS= read -r line; do
    if [[ "$line" =~ '^background[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})' ]]; then
      print -r -- "$match[1]"
      return 0
    fi
  done < "$theme_dir/ghostty.conf"

  return 1
}

__terminal_theme_is_light() {
  emulate -L zsh
  setopt local_options no_aliases

  local hex="$1"
  [[ "$hex" == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]] || return 1

  local -u body="${hex#\#}"
  local red green blue luminance
  red="$((16#${body[1,2]}))"
  green="$((16#${body[3,4]}))"
  blue="$((16#${body[5,6]}))"
  luminance="$((299 * red + 587 * green + 114 * blue))"

  (( luminance >= 128000 ))
}

__terminal_theme_apply_system_appearance() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" bg dark_mode

  command -v osascript >/dev/null 2>&1 || return 1
  bg="$(__terminal_theme_background "$theme_dir")" || return 1

  if __terminal_theme_is_light "$bg"; then
    dark_mode=false
  else
    dark_mode=true
  fi

  osascript >/dev/null 2>&1 <<APPLESCRIPT
tell application "System Events"
  tell appearance preferences to set dark mode to $dark_mode
end tell
APPLESCRIPT
}

__terminal_theme_wallpaper_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" ghostty_file line

  ghostty_file="$theme_dir/ghostty.conf"
  [[ -r "$ghostty_file" ]] || return 1

  while IFS= read -r line; do
    if [[ "$line" =~ '^#[[:space:]]*wallpaper-color[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})' ]]; then
      print -r -- "$match[1]"
      return 0
    fi
  done < "$ghostty_file"

  return 1
}

__terminal_theme_generate_solid_wallpaper() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" theme hex body cache_dir wallpaper tmp_ppm
  local -u upper_body

  command -v perl >/dev/null 2>&1 || return 1
  command -v sips >/dev/null 2>&1 || return 1

  theme="${theme_dir:t}"
  hex="$(__terminal_theme_wallpaper_color "$theme_dir")" || return 1
  [[ "$hex" == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]] || return 1

  body="${hex#\#}"
  upper_body="$body"
  cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/tt/wallpapers"
  wallpaper="$cache_dir/$theme-$upper_body.png"
  tmp_ppm="$cache_dir/$theme-$upper_body.ppm.$$"

  if [[ -r "$wallpaper" ]]; then
    print -r -- "$wallpaper"
    return 0
  fi

  command mkdir -p "$cache_dir" || return 1

  perl -e '
    my ($out, $hex) = @ARGV;
    $hex =~ s/^#//;
    my @rgb = map { hex($_) } ($hex =~ /(..)(..)(..)/);
    open my $fh, ">:raw", $out or die "cannot write $out: $!";
    print {$fh} "P6\n1 1\n255\n", pack("C3", @rgb);
    close $fh;
  ' "$tmp_ppm" "$hex" || return 1

  if sips -s format png "$tmp_ppm" --out "$wallpaper" >/dev/null 2>&1; then
    command rm -f "$tmp_ppm"
    print -r -- "$wallpaper"
    return 0
  fi

  command rm -f "$tmp_ppm"
  return 1
}

__terminal_theme_apply_wallpaper() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" wallpaper escaped

  [[ "${TERMINAL_THEME_WALLPAPER:-1}" != "0" ]] || return 1
  command -v osascript >/dev/null 2>&1 || return 1

  wallpaper="$(__terminal_theme_generate_solid_wallpaper "$theme_dir")" || return 1
  escaped="${wallpaper//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"

  osascript >/dev/null 2>&1 <<APPLESCRIPT
tell application "System Events"
  set picture of every desktop to "$escaped"
end tell
APPLESCRIPT
}

__terminal_theme_ensure_ghostty_active_theme() {
  emulate -L zsh
  setopt local_options no_aliases

  local config="$1" tmp_config

  [[ -w "$config" ]] || return 1
  grep -Eq '^theme[[:space:]]*=[[:space:]]*terminal-active[[:space:]]*$' "$config" && return 0

  tmp_config="${config}.tmp.$$"
  awk '
    BEGIN { changed = 0 }
    /^theme[[:space:]]*=/ {
      print "theme = terminal-active"
      changed = 1
      next
    }
    { print }
    END {
      if (!changed) {
        print "theme = terminal-active"
      }
    }
  ' "$config" > "$tmp_config" && command mv -f "$tmp_config" "$config"
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

__terminal_theme_swatch() {
  emulate -L zsh
  setopt local_options no_aliases

  local hex="$1" rgb
  rgb="$(__terminal_theme_rgb "$hex")" || return
  printf '\033[48;2;%sm   \033[0m' "$rgb"
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

  local theme_dir="$1" ghostty_file theme line name i bg fg accent selection_bg selection_fg cols pad
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

  __terminal_theme_line "$bg" "$fg" ""
  __terminal_theme_style "$bg" "$fg"
  printf ' %s%*s\033[0m\n' "$theme" "$(( ${FZF_PREVIEW_COLUMNS:-${COLUMNS:-80}} - ${#theme} - 1 ))" ''
  __terminal_theme_line "$bg" "$fg" ""
  __terminal_theme_style "$bg" "$fg"
  printf '  '
  __terminal_theme_swatch "$bg"
  __terminal_theme_swatch "$fg"
  printf '  '

  for i in {1..6}; do
    [[ -n "${palette[$i]:-}" ]] && __terminal_theme_swatch "${palette[$i]}"
  done

  cols="$(__terminal_theme_preview_columns)"
  pad=$((cols - 28))
  (( pad < 0 )) && pad=0
  __terminal_theme_style "$bg" "$fg"
  printf '%*s\033[0m\n' "$pad" ''
  __terminal_theme_line "$bg" "$fg" ""
}

__terminal_theme_select() {
  local themes_dir theme preview_source preview_cmd
  themes_dir="$1"

  if command -v fzf >/dev/null 2>&1; then
    preview_source="${functions_source[__terminal_theme_preview]}"
    preview_cmd="zsh -fc 'source \"\$1\" && __terminal_theme_preview \"\$2\"' _ ${(q)preview_source} ${(q)themes_dir}/{}"

    print -rl -- "$themes_dir"/*(N:t) | fzf \
      --prompt='theme> ' \
      --height=~90% \
      --reverse \
      --cycle \
      --no-multi \
      --bind='enter:accept' \
      --preview-window='right,45%,border-left' \
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
  local -a themes
  root="$(__terminal_theme_root)"
  themes_dir="$root/themes"
  themes=("$themes_dir"/*(N:t))

  (( CURRENT == 2 )) || return 0

  compadd -a themes
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

  local ghostty_config ghostty_theme ghostty_theme_dir
  ghostty_config="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"
  ghostty_theme="terminal-active"
  ghostty_theme_dir="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/themes"

  command mkdir -p "$active_dir"
  command cp -f "$themes_dir/$theme/ghostty.conf" "$active_dir/ghostty.conf"
  command mkdir -p "$ghostty_theme_dir"
  command cp -f "$themes_dir/$theme/ghostty.conf" "$ghostty_theme_dir/$ghostty_theme"
  command cp -f "$themes_dir/$theme/nvim.lua" "$active_dir/nvim.lua"
  print -r -- "$theme" > "$current_file"
  __terminal_theme_apply_system_appearance "$themes_dir/$theme" || true
  __terminal_theme_apply_wallpaper "$themes_dir/$theme" || true
  __terminal_theme_ensure_ghostty_active_theme "$ghostty_config" || true
  __terminal_theme_apply_herdr "$themes_dir/$theme" || true

  __terminal_theme_apply_env

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
