local brew_prefix="${HOMEBREW_PREFIX:-/opt/homebrew}"

# Wraps every ZLE widget that exists when it loads, so it has to come after fzf,
# zoxide and anything else that defines one.

# MANUAL_REBIND skips the widget-rebind check on every prompt. Safe only because
# nothing defines widgets after this point.
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

zsh_source_compiled "$brew_prefix/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

bindkey '^ ' autosuggest-accept
