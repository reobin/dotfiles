# Wraps every ZLE widget that exists when it loads, so it has to come after
# fzf, fzf-tab, zoxide and anything else that defines one.

# MANUAL_REBIND skips the widget-rebind check on every prompt. Safe only because
# nothing defines widgets after this point.
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

# fzf-tab isn't packaged on Fedora, so it's optional (manual install to
# ~/.local/share/fzf-tab). Everything else works without it.
# Not cacheable: fzf-tab resolves its lib/ and modules/ from ${0:A:h}, so a
# cache copy would point FZF_TAB_HOME at the cache directory.
for _fzf_tab in ~/.local/share/fzf-tab/fzf-tab.zsh; do
  [[ -r $_fzf_tab ]] && source "$_fzf_tab"
done
unset _fzf_tab

# dnf: zsh-autosuggestions -> /usr/share/zsh-autosuggestions/.
for _autosuggest in /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh; do
  [[ -r $_autosuggest ]] && zsh_source_compiled "$_autosuggest"
done
unset _autosuggest

if (( $+widgets[autosuggest-accept] )); then
  bindkey '^ ' autosuggest-accept
fi
