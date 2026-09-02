local brew_prefix="${HOMEBREW_PREFIX:-/opt/homebrew}"

# Wraps every ZLE widget that exists when it loads, so it has to come after
# fzf, fzf-tab, zoxide and anything else that defines one.

# MANUAL_REBIND skips the widget-rebind check on every prompt. Safe only because
# nothing defines widgets after this point.
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

# Not cacheable: fzf-tab resolves its lib/ and modules/ from ${0:A:h}, so a
# cache copy would point FZF_TAB_HOME at the cache directory. TAB goes to it
# rather than fzf's ** trigger, which it supersedes.
source "$brew_prefix/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh"

zsh_source_compiled "$brew_prefix/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

bindkey '^ ' autosuggest-accept
