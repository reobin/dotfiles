# `reobin/dotfiles` (macOS)

Ever evolving dotfiles for macOS.

## Get started

```sh
git clone git@github.com:reobin/dotfiles.git $HOME/dotfiles
cd $HOME/dotfiles
./macos/init
```

## Manual steps

Everything is handled by `./macos/init` except the Helium extensions, which
Chromium only wires up through the browser UI.

### Tab keys

1. Open `chrome://extensions` in Helium and enable developer mode.
2. Load unpacked, then select `helium/extensions/tab-keys`.
3. Open `chrome://extensions/shortcuts` and bind the two group commands to
   `option+l` and `option+h`. Chromium suggests at most four shortcuts, and the
   `j`/`k` pairs already take them.

### Surfingkeys

1. Install Surfingkeys, then enable "Allow access to file URLs" for it in
   `chrome://extensions`.
2. Open its options page and set "Load settings from" to
   `file:///Users/<you>/.config/surfingkeys/config.js`. The path has to be
   absolute, `~` and `$HOME` are not expanded.

Surfingkeys reads that file on browser start. After editing it, press "Load
settings from" on the options page to pick the change up.
