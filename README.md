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

The setup installs Homebrew CLI tools, Ghostty, Hermes, Herdr, Neovim, and the
repository-managed shell and Git configuration. Hermes' provider credentials
and runtime state stay in `~/.hermes` and are not committed here.

## Hermes

Run `./macos/init` to install Hermes using the upstream installer and stow the
safe local baseline. Then complete the interactive provider setup:

```sh
hermes setup
hermes doctor
hermes --tui
```

For the fastest setup, use `hermes setup --portal`. Otherwise choose a provider
with `hermes model`. Start with the default bundled skills and add only skills
you need:

```sh
hermes skills browse
hermes skills search github
hermes skills inspect <source/path>
hermes skills install <source/path>
```

The baseline keeps dangerous command approval enabled, denies dangerous cron
commands, and requires approval before Hermes writes or changes skills. Do not
enable `--yolo` or connect a messaging gateway until the local CLI works; if you
do add a gateway, use explicit user allowlists or pairing and prefer a Docker
terminal backend for unattended work.
