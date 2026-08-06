# `reobin/dotfiles` (macOS)

Ever evolving dotfiles for macOS.

## Get started

```sh
git clone git@github.com:reobin/dotfiles.git $HOME/dotfiles
cd $HOME/dotfiles
./macos/init
```

## Manual steps

Everything is handled by `./macos/init` except the Helium extension, which
Chromium only loads through the browser UI:

1. Open `chrome://extensions` in Helium and enable developer mode.
2. Load unpacked, then select `helium/extensions/tab-keys`.
