# Non-login, non-interactive shells read only this file, so anything that shells
# out (nvim, git hooks, scripts) would otherwise miss mise entirely. .zprofile
# and .zshrc put the shims ahead of this again for login and interactive shells.
path=($HOME/.local/share/mise/shims(N-/) $path)
typeset -U path

# Package caches live beside the repos so installs write there instead of
# ~/Library. Here rather than .zshrc so scripts and agent shells pick them up.
# pnpm 11+ only. pnpm 10 and older read pnpm/Library/Preferences/pnpm/rc.
export pnpm_config_store_dir=$HOME/GitHub/.cache/pnpm-store
export YARN_GLOBAL_FOLDER=$HOME/GitHub/.cache/yarn-berry
export YARN_CACHE_FOLDER=$HOME/GitHub/.cache/yarn
export npm_config_cache=$HOME/GitHub/.cache/npm
export BUN_INSTALL_CACHE_DIR=$HOME/GitHub/.cache/bun
export CYPRESS_CACHE_FOLDER=$HOME/GitHub/.cache/Cypress
export PLAYWRIGHT_BROWSERS_PATH=$HOME/GitHub/.cache/ms-playwright

export HERDR_CALLSIGNS_SCHEME=serial
