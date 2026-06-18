__terminal_theme_root() {
  print -r -- "${XDG_CONFIG_HOME:-$HOME/.config}/tt"
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

__terminal_theme_complementary_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local hex="$1"

  command -v perl >/dev/null 2>&1 || return 1
  [[ "$hex" == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]] || return 1

  perl -e '
    my ($hex) = @ARGV;
    $hex =~ s/^#//;

    my ($red, $green, $blue) = map { hex($_) / 255 } ($hex =~ /(..)(..)(..)/);
    my $max = $red > $green ? ($red > $blue ? $red : $blue) : ($green > $blue ? $green : $blue);
    my $min = $red < $green ? ($red < $blue ? $red : $blue) : ($green < $blue ? $green : $blue);
    my ($hue, $sat, $light) = (0, 0, ($max + $min) / 2);

    if ($max != $min) {
      my $delta = $max - $min;
      $sat = $light > 0.5 ? $delta / (2 - $max - $min) : $delta / ($max + $min);

      if ($max == $red) {
        $hue = (($green - $blue) / $delta + ($green < $blue ? 6 : 0)) / 6;
      } elsif ($max == $green) {
        $hue = (($blue - $red) / $delta + 2) / 6;
      } else {
        $hue = (($red - $green) / $delta + 4) / 6;
      }
    }

    $hue += 0.5;
    $hue -= 1 if $hue >= 1;
    $sat *= 0.75;
    $sat = 0.18 if $sat < 0.18;
    $sat = 0.38 if $sat > 0.38;

    if ($light < 0.35) {
      $light = 0.42;
    } elsif ($light > 0.70) {
      $light = 0.82;
    }

    sub hue_to_rgb {
      my ($p, $q, $t) = @_;
      $t += 1 if $t < 0;
      $t -= 1 if $t > 1;
      return $p + ($q - $p) * 6 * $t if $t < 1 / 6;
      return $q if $t < 1 / 2;
      return $p + ($q - $p) * (2 / 3 - $t) * 6 if $t < 2 / 3;
      return $p;
    }

    my ($out_red, $out_green, $out_blue);

    if ($sat == 0) {
      ($out_red, $out_green, $out_blue) = ($light, $light, $light);
    } else {
      my $q = $light < 0.5 ? $light * (1 + $sat) : $light + $sat - $light * $sat;
      my $p = 2 * $light - $q;
      $out_red = hue_to_rgb($p, $q, $hue + 1 / 3);
      $out_green = hue_to_rgb($p, $q, $hue);
      $out_blue = hue_to_rgb($p, $q, $hue - 1 / 3);
    }

    printf "#%02X%02X%02X\n", map { int($_ * 255 + 0.5) } ($out_red, $out_green, $out_blue);
  ' "$hex"
}

__terminal_theme_wallpaper_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" ghostty_file line bg
  local -A color palette

  ghostty_file="$theme_dir/ghostty.conf"
  [[ -r "$ghostty_file" ]] || return 1

  while IFS= read -r line; do
    if [[ "$line" =~ '^#[[:space:]]*wallpaper-color[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})' ]]; then
      color[wallpaper-color]="$match[1]"
    elif [[ "$line" =~ '^palette[[:space:]]*=[[:space:]]*([0-9]+)=(#[0-9A-Fa-f]{6})' ]]; then
      palette[$match[1]]="$match[2]"
    elif [[ "$line" =~ '^([[:alpha:]-]+)[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})' ]]; then
      color[$match[1]]="$match[2]"
    fi
  done < "$ghostty_file"

  if [[ -n "${color[wallpaper-color]:-}" ]]; then
    print -r -- "${color[wallpaper-color]}"
    return 0
  fi

  bg="${color[background]:-${palette[0]:-#000000}}"
  __terminal_theme_complementary_color "$bg"
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
  command cp -f "$themes_dir/$theme/tmux.conf" "$active_dir/tmux.conf"
  print -r -- "$theme" > "$current_file"
  __terminal_theme_apply_system_appearance "$themes_dir/$theme" || true
  __terminal_theme_apply_wallpaper "$themes_dir/$theme" || true
  __terminal_theme_ensure_ghostty_active_theme "$ghostty_config" || true

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
