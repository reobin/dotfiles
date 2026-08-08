# `reobin/dotfiles` (macOS remote box)

Minimal macOS setup for a network-accessible remote box.

## Get started

```sh
git clone git@github.com:reobin/dotfiles.git $HOME/dotfiles
cd $HOME/dotfiles
./macos/init
```

## Manual steps

Everything in the initial setup is handled by `./macos/init`.

The setup installs Homebrew CLI tools, Ghostty, Herdr, Neovim, and the
repository-managed shell and Git configuration. Hermes and service-specific
integrations are intentionally not installed yet.
