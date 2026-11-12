# Non-login, non-interactive shells read only this file, so anything that shells
# out (nvim, git hooks, scripts) would otherwise miss mise entirely. .zprofile
# and .zshrc put the shims ahead of this again for login and interactive shells.
path=($HOME/.local/share/mise/shims(N-/) $path)
typeset -U path

# mise owns browse's version; its own updater would npm install -g behind mise's back.
export OPENCODE_BROWSER_AUTO_UPDATE=off
