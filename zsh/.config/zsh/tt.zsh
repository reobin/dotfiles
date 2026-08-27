# The half of `tt` that only runs when `tt` runs. theme.zsh loads it on the first
# call; macos/dotfiles/tt sources it directly for __terminal_theme_apply_herdr.
#
# `tt` reaches back to theme.zsh for __terminal_theme_root and
# __terminal_theme_apply_env, so sourcing this file alone is only safe for the
# entry points that skip them: apply_herdr, and preview in the fzf subshell.

# Read a `[theme.custom]` token out of the theme's herdr.toml, so a sidebar row
# (which takes a hex and cannot name a token) gets the same value Herdr paints
# its state dot from.
#
# `${name}` is braced because a bare `$name` in front of `[[:space:]]` parses as
# an array subscript, not as the parameter followed by a character class.
__terminal_theme_custom_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" name="$2" line

  [[ -r "$theme_dir/herdr.toml" ]] || return 1

  while IFS= read -r line; do
    if [[ "$line" =~ "^[[:space:]]*${name}[[:space:]]*=[[:space:]]*[\"'](#[0-9A-Fa-f]{6})[\"']" ]]; then
      print -r -- "$match[1]"
      return 0
    fi
  done < "$theme_dir/herdr.toml"

  return 1
}

# Whether the theme names the token at all, separate from whether its value could
# be parsed: pinning a token the theme also names is a duplicate key, and Herdr
# answers a duplicate key by discarding the file.
__terminal_theme_declares_custom_color() {
  emulate -L zsh
  setopt local_options no_aliases

  command grep -qE "^[[:space:]]*$2[[:space:]]*=" "$1/herdr.toml"
}

# Read a sidebar color out of the theme's palette so it cannot drift from the
# colorscheme. Callers pass both ANSI slots: the bright one on ink backgrounds,
# the normal one on paper, where bright colors wash out.
__terminal_theme_palette_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" dark_slot="$2" light_slot="$3" ghostty_file bg slot line

  ghostty_file="$theme_dir/ghostty.conf"
  [[ -r "$ghostty_file" ]] || return 1

  bg="$(__terminal_theme_background "$theme_dir")" || return 1

  if __terminal_theme_is_light "$bg"; then
    slot="$light_slot"
  else
    slot="$dark_slot"
  fi

  while IFS= read -r line; do
    if [[ "$line" =~ "^palette[[:space:]]*=[[:space:]]*$slot=(#[0-9A-Fa-f]{6})" ]]; then
      print -r -- "$match[1]"
      return 0
    fi
  done < "$ghostty_file"

  return 1
}

# Herdr allows one `[theme.custom]` block and `overlay0` has to be recessive
# against the active background, which no single gray is on both paper and ink.
# So the block lives per theme and gets concatenated onto the base config here.
# The result is config.toml, Herdr's default path, so a running server picks it
# up on reload.
__terminal_theme_apply_herdr() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" herdr_dir tmp hot working done_color idle last_table token
  local -a pinned
  herdr_dir="${XDG_CONFIG_HOME:-$HOME/.config}/herdr"

  [[ -r "$herdr_dir/config.base.toml" ]] || return 1
  [[ -r "$theme_dir/herdr.toml" ]] || return 1

  # Each color resolves from the theme's own token, then the ANSI slot, then a
  # fallback that belongs to no palette, which is worth a warning. Whatever it
  # resolves to is also pinned onto `[theme.custom]` below unless the theme named
  # it, so Herdr's state dot and the rows cannot disagree.
  if ! hot="$(__terminal_theme_custom_color "$theme_dir" red)"; then
    __terminal_theme_declares_custom_color "$theme_dir" red || pinned+=("red")
    if ! hot="$(__terminal_theme_palette_color "$theme_dir" 9 1)"; then
      hot="#E05252"
      print -u2 -- "tt: no red in ${theme_dir:t}/ghostty.conf palette, using $hot"
    fi
  fi

  if ! working="$(__terminal_theme_custom_color "$theme_dir" yellow)"; then
    __terminal_theme_declares_custom_color "$theme_dir" yellow || pinned+=("yellow")
    if ! working="$(__terminal_theme_palette_color "$theme_dir" 11 3)"; then
      working="#C9A227"
      print -u2 -- "tt: no yellow in ${theme_dir:t}/ghostty.conf palette, using $working"
    fi
  fi

  # Herdr splits finished across two keys: done reads `teal` and idle reads
  # `green` (src/ui/status.rs, state_label_color, which state_icon also colors
  # the dot from). The rows under both take the done color, so both keys get
  # pinned to it, and the value still comes from the theme's own `green`. Pin
  # only what the theme did not declare, asked per key, or the file carries one
  # twice. Blocked reads `red` and working reads `yellow`; Herdr documents none
  # of this.
  if ! done_color="$(__terminal_theme_custom_color "$theme_dir" green)"; then
    if ! done_color="$(__terminal_theme_palette_color "$theme_dir" 10 2)"; then
      done_color="#4FA76A"
      print -u2 -- "tt: no green in ${theme_dir:t}/ghostty.conf palette, using $done_color"
    fi
  fi
  __terminal_theme_declares_custom_color "$theme_dir" green || pinned+=("green")
  __terminal_theme_declares_custom_color "$theme_dir" teal || pinned+=("teal")

  # Not a state color: `unknown` is Herdr having no status to report, so that row
  # claims nothing and takes the ordinary foreground.
  if ! idle="$(__terminal_theme_conf_color "$theme_dir" foreground)"; then
    idle="#808080"
    print -u2 -- "tt: no foreground in ${theme_dir:t}/ghostty.conf, using $idle"
  fi

  # Pinned keys are appended bare, so they land in whatever table the fragment
  # ended in. A fragment that does not end in `[theme.custom]` would silently
  # move Herdr's colors into another table.
  last_table="$(command grep -o '^\[[^]]*\]' "$theme_dir/herdr.toml" | command tail -1)"
  if [[ "$last_table" != "[theme.custom]" ]]; then
    print -u2 -- "tt: ${theme_dir:t}/herdr.toml ends in ${last_table:-no table}, not [theme.custom]"
    return 1
  fi

  tmp="$herdr_dir/config.toml.tmp.$$"

  # `return` inside the group would skip the cleanup and strand the temp file in
  # herdr_dir, which is a stow symlink into this repo. Chain on && instead.
  {
    command sed -e "s/\"@hot\"/\"$hot\"/g" -e "s/\"@working\"/\"$working\"/g" \
      -e "s/\"@done\"/\"$done_color\"/g" -e "s/\"@idle\"/\"$idle\"/g" \
      "$herdr_dir/config.base.toml" &&
      print &&
      print -r -- "# appended by tt from tt/themes/${theme_dir:t}/herdr.toml" &&
      command cat "$theme_dir/herdr.toml" &&
      { (( ! $#pinned )) || {
        print &&
          print -r -- "# pinned by tt so Herdr's state dot matches the agent rows" &&
          for token in $pinned; do
            case "$token" in
              red) print -r -- "red = \"$hot\"" ;;
              yellow) print -r -- "yellow = \"$working\"" ;;
              green) print -r -- "green = \"$done_color\"" ;;
              teal) print -r -- "teal = \"$done_color\"" ;;
            esac
          done
      } }
  } > "$tmp" || { command rm -f "$tmp"; return 1 }

  # An unsubstituted placeholder reaches Herdr as a color and costs the whole
  # file, so keep the config already in place rather than one Herdr will refuse.
  if command grep -qE '^[^#]*"@(hot|working|done|idle)"' "$tmp"; then
    print -u2 -- "tt: unsubstituted placeholder in herdr/config.base.toml, keeping the current config.toml"
    command rm -f "$tmp"
    return 1
  fi

  command mv -f "$tmp" "$herdr_dir/config.toml" || { command rm -f "$tmp"; return 1 }
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

# Anchored so `foreground` does not answer for `selection-foreground`. `${name}`
# is braced for the same reason as in __terminal_theme_custom_color.
__terminal_theme_conf_color() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" name="$2" line

  [[ -r "$theme_dir/ghostty.conf" ]] || return 1

  while IFS= read -r line; do
    if [[ "$line" =~ "^${name}[[:space:]]*=[[:space:]]*(#[0-9A-Fa-f]{6})" ]]; then
      print -r -- "$match[1]"
      return 0
    fi
  done < "$theme_dir/ghostty.conf"

  return 1
}

__terminal_theme_background() {
  __terminal_theme_conf_color "$1" background
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

# The wallpaper color is the ceiling, not the midpoint: it paints the top-left
# corner and the diagonal gradient only deepens from there.
#
# `span` is a percentage of the color's own brightness, not a count of RGB levels,
# because the eye judges a brightness step against what it sits on. `ramp` is the
# share of the diagonal the transition happens over; holding the corners flat and
# spending the span over the middle steepens the part the eye is on without
# darkening either end.
#
# All four land in the cache name, so changing one regenerates.
__terminal_theme_wallpaper_span=30
__terminal_theme_wallpaper_ramp=55
__terminal_theme_wallpaper_width=2048
__terminal_theme_wallpaper_height=1280

__terminal_theme_generate_wallpaper() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" theme hex body cache_dir wallpaper tmp_ppm tmp_png span ramp size
  local -u upper_body

  command -v perl >/dev/null 2>&1 || return 1
  command -v sips >/dev/null 2>&1 || return 1

  theme="${theme_dir:t}"
  hex="$(__terminal_theme_wallpaper_color "$theme_dir")" || return 1
  [[ "$hex" == \#[[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]][[:xdigit:]] ]] || return 1

  span="$__terminal_theme_wallpaper_span"
  ramp="$__terminal_theme_wallpaper_ramp"
  body="${hex#\#}"
  upper_body="$body"
  size="${__terminal_theme_wallpaper_width}x${__terminal_theme_wallpaper_height}"
  cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/tt/wallpapers"
  wallpaper="$cache_dir/$theme-$upper_body-$size-grad$span-ramp$ramp.png"
  tmp_ppm="$cache_dir/$theme-$upper_body-$size-grad$span-ramp$ramp.ppm.$$"
  tmp_png="$wallpaper.$$"

  if [[ -r "$wallpaper" ]]; then
    print -r -- "$wallpaper"
    return 0
  fi

  command mkdir -p "$cache_dir" || return 1

  # Scale the channels together rather than adding a flat offset, which would walk
  # the hue toward gray. Then dither: a few dozen levels spread corner to corner
  # is a visible band every hundred-odd pixels.
  perl -e '
    my ($out, $hex, $width, $height, $percent, $ramp) = @ARGV;
    $hex =~ s/^#//;
    my @base = map { hex($_) } ($hex =~ /(..)(..)(..)/);
    my $span = $percent / 100;
    my $steep = 100 / ($ramp < 1 ? 1 : $ramp);
    my @dither = (0, 4, 2, 6, 1, 5, 3, 7);
    my $diag = $width + $height - 2;

    # Depth runs on x + y, so every row is the one above shifted a pixel along:
    # build the diagonal once and cut rows out of it. Two strips, because the
    # dither phase has to flip on alternating rows or the pattern lays down in
    # unbroken 45 degree lines.
    my @strip;
    for my $parity (0, 1) {
      my $pixels = "";

      for my $d (0 .. $diag) {
        my $t = $diag > 0 ? $d / $diag : 0;

        # Pull the run in around the middle, then round the shoulders off: the
        # clamp alone leaves a crease where it bites, and a crease in a flat field
        # is more visible than the gradient.
        my $u = 0.5 + ($t - 0.5) * $steep;
        $u = $u < 0 ? 0 : $u > 1 ? 1 : $u;
        $u = $u * $u * (3 - 2 * $u);

        my $scale = 1 - $span * $u;
        my $threshold = ($dither[($d + 4 * $parity) % 8] + 0.5) / 8;

        $pixels .= pack("C3", map {
          my $v = $_ * $scale;
          my $level = int($v);
          $level++ if $v - $level > $threshold;
          $level < 0 ? 0 : $level > 255 ? 255 : $level;
        } @base);
      }

      $strip[$parity] = $pixels;
    }

    open my $fh, ">:raw", $out or die "cannot write $out: $!";
    print {$fh} "P6\n$width $height\n255\n";

    for my $y (0 .. $height - 1) {
      print {$fh} substr($strip[$y % 2], $y * 3, $width * 3);
    }

    close $fh;
  ' "$tmp_ppm" "$hex" \
    "$__terminal_theme_wallpaper_width" "$__terminal_theme_wallpaper_height" "$span" "$ramp" ||
    { command rm -f "$tmp_ppm"; return 1 }

  # Convert to a sibling and rename, so an interrupted run cannot leave a
  # truncated PNG at the cache path for the read above to take as a hit.
  if sips -s format png "$tmp_ppm" --out "$tmp_png" >/dev/null 2>&1 &&
    command mv -f "$tmp_png" "$wallpaper"; then
    command rm -f "$tmp_ppm"
    print -r -- "$wallpaper"
    return 0
  fi

  command rm -f "$tmp_ppm" "$tmp_png"
  return 1
}

__terminal_theme_apply_wallpaper() {
  emulate -L zsh
  setopt local_options no_aliases

  local theme_dir="$1" wallpaper escaped

  [[ "${TERMINAL_THEME_WALLPAPER:-1}" != "0" ]] || return 1
  command -v osascript >/dev/null 2>&1 || return 1

  wallpaper="$(__terminal_theme_generate_wallpaper "$theme_dir")" || return 1
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

  local theme_dir="$1" ghostty_file theme line i bg fg cols pad
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
