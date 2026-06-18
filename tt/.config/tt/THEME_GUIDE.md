# Terminal Theme Guide

Keep themes small, coherent, and tested across Ghostty, Neovim, Starship, and
Herdr.

## Files

Each theme lives in `themes/<name>/` with:

* `ghostty.conf` - terminal palette and surface colors
* `nvim.lua` - Neovim colorscheme metadata

Mirror `ghostty.conf` to `ghostty/.config/ghostty/themes/terminal-<name>` or
`.config/ghostty/themes/terminal-<name>` inside this package so Ghostty can
load it directly. Do not duplicate a mirror already owned by the `ghostty`
stow package.

## Palette Rules

Use ANSI slots intentionally. Herdr and Starship both consume terminal ANSI
colors, so these slots are part of the UI contract.

For light themes:

* `palette 0` should be the main light background.
* `palette 8` should be a muted light background or selection color.
* `palette 7` should be a readable foreground.
* `palette 15` should be a readable muted/bright foreground.

For dark themes:

* `palette 0` should be the main dark background.
* `palette 8` should be a muted dark foreground or border color.
* `palette 7` should be the normal foreground.
* `palette 15` should be the bright foreground.

Avoid using real white for `7` or `15` in light themes. Avoid using real black
for `0` or `8` in light themes. Those choices tend to break Herdr sidebar
selection and Starship prompt contrast.

## Taste

Prefer retro palettes with restraint:

* warm or paper-like backgrounds
* muted but distinct red, green, yellow, blue, magenta, and cyan
* foreground contrast that is readable without feeling stark
* selection colors that are visible but not loud

Avoid adding a theme unless it looks good in all four places:

* Ghostty shell text
* Herdr sidebar, selected row, and inactive rows
* Starship branch/status prompt
* Neovim editor, floating windows, and statusline

## Add Checklist

1. Create `themes/<name>/ghostty.conf` and `nvim.lua`.
2. Add the Neovim plugin only if no existing plugin provides the colorscheme.
3. Mirror the Ghostty palette to `ghostty/.config/ghostty/themes/terminal-<name>`.
4. Run `tt <name>` or choose it with `tt`.
5. Open Herdr and verify sidebar contrast.
6. Open Neovim and verify startup has no Lazy errors.
