local brew_prefix="${HOMEBREW_PREFIX:-/opt/homebrew}"

# Both plugins wrap every ZLE widget that exists when they load, so they have to
# come after fzf, zoxide and anything else that defines one.

# MANUAL_REBIND skips the widget-rebind check on every prompt. Safe only because
# nothing defines widgets after this point.
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

zsh_source_compiled "$brew_prefix/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

bindkey '^ ' autosuggest-accept

zsh_source_compiled "$brew_prefix/share/zsh-fast-syntax-highlighting/fast-syntax-highlighting.plugin.zsh"
