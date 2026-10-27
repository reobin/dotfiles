# reviewr keeps its own palette and cannot read the terminal's, so this keeps
# its single `theme` key on the system appearance. Dark pairs with the ink
# terminal (wave-zen's mapping), light with the paper one (kanso-pearl's).
# reviewr re-reads its config on the next refresh, so nothing restarts.
__appearance_reviewr_theme() {
  emulate -L zsh
  setopt local_options no_aliases

  local config_dir config_file style want current
  if [[ -z "$__appearance_reviewr_dir" ]]; then
    if command -v herdr >/dev/null 2>&1; then
      __appearance_reviewr_dir="$(herdr plugin config-dir persiyanov.reviewr 2>/dev/null | command tr -d '[:space:]')"
    fi
    [[ -n "$__appearance_reviewr_dir" ]] || __appearance_reviewr_dir="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/plugins/config/persiyanov.reviewr"
  fi
  config_dir="$__appearance_reviewr_dir"
  config_file="$config_dir/config.toml"
  [[ -r "$config_file" ]] || return 0

  if style="$(defaults read -g AppleInterfaceStyle 2>/dev/null)"; then
    [[ "$style" == "Dark" ]] && want="tokyo-night" || want="rose-pine-dawn"
  else
    want="rose-pine-dawn"
  fi
  [[ "$__appearance_reviewr_theme" == "$want" ]] && return 0
  __appearance_reviewr_theme="$want"

  current="$(command grep -E '^theme[[:space:]]*=' "$config_file" | command tail -1)"
  [[ "$current" == *"$want"* ]] && return 0

  command sed -i '' -e 's/^theme[[:space:]]*=.*/theme = "'"$want"'"/' "$config_file"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __appearance_reviewr_theme
__appearance_reviewr_theme
