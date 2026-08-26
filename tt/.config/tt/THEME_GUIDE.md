# Terminal Theme Guide

Keep themes small, coherent, and tested across Ghostty, Neovim, Starship, and
Herdr.

## Files

Each theme lives in `themes/<name>/` with:

* `ghostty.conf` - terminal palette and surface colors
* `nvim.lua` - Neovim colorscheme metadata
* `herdr.toml` - Herdr color overrides for this theme

Each `ghostty.conf` must declare a static wallpaper color:

* `# wallpaper-color = #RRGGBB`

`tt` paints the desktop with a diagonal gradient rather than a flat fill. The
declared color is the top-left corner and the gradient only deepens toward the
bottom-right, so pick the brightest the desktop should ever get, not an average.

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

## Herdr Overrides

`tt` concatenates `~/.config/herdr/config.base.toml` and this theme's
`herdr.toml` into `~/.config/herdr/config.toml`, then reloads Herdr. Herdr
allows one `[theme.custom]` block, so it lives here rather than in the `herdr`
package, and only this file may declare it.

Every theme must set `overlay0`, which Herdr uses for both inactive pane
borders and dimmed hint text:

* aim for a contrast ratio near 2.1:1 against the theme background
* keep the hue in the theme's family, warm on paper themes and cool on ink ones

Much lower and the hint text disappears. Much higher and the inactive border
starts competing with the active one, which Herdr paints in `accent` (ANSI 4).

Every theme must also set `sidebar_bg` and `selection_bg`, both of which Herdr
gained in 0.8.2:

* `sidebar_bg` is the sidebar background. Take the theme background down a little
  over two points of HSL lightness and keep the hue, a bit under the step
  Catppuccin puts between `base` and `mantle`. The spaces list should read as its
  own surface without its edge landing as a seam down the screen. Three points was
  a seam and one and a half read as nothing, so this sits between them. Down and
  never up: a lifted panel competes with the panes in front of it.
* `selection_bg` is the row the navigate cursor sits on. Use this theme's
  `selection-background` from `ghostty.conf`. It is already a highlight that
  reads without shouting, it cannot drift from the palette, and it stays distinct
  from the fill Herdr paints on the active space and agent rows.

The sidebar also needs three colors of its own: a loud one for the rows that flag
an agent waiting on you, a busy one for the rows that say an agent is still going,
and a calm one for the rows that say an agent finished. Nothing declares them.
`tt` reads them out of `ghostty.conf` and substitutes them into the `@hot`,
`@working` and `@done` placeholders in `config.base.toml`, because sidebar rows
accept a hex foreground and nothing else and cannot name a `[theme.custom]` color.

The slots it reads are ANSI red, yellow and green, already the theme's alarm,
attention and success colors:

* `palette 9`, `palette 11` and `palette 10` on dark backgrounds
* `palette 1`, `palette 3` and `palette 2` on light ones, where the bright trio
  washes out

So a theme gets all three for free, and they cannot drift from the palette. The
slot is taken as the theme gives it, contrast included: catppuccin-latte puts
`#DF8E1D` in its yellow and `#EFF1F5` in its background, so its busy rows sit at
2.2:1 and read washed out. A theme missing a slot still gets a working config,
but `tt` warns and falls back to a color that belongs to no palette.

Reading the slot rather than picking a color per theme means the busy color is
whatever the theme put in its yellow, which is not always yellow: kanso-pearl has
an olive there. That is the trade the slot rule buys, and it is fine as long as
the three still land apart, which is the only thing the row needs.

When they do not, the theme sets the token itself in `[theme.custom]`:

* `red = "#RRGGBB"` for the loud color
* `yellow = "#RRGGBB"` for the busy one
* `green = "#RRGGBB"` for the calm one

These are Herdr's own semantic tokens, and Herdr paints the state dot on the
first row of every space from them. `tt` resolves each one from the theme's block
when it is declared there and from the ANSI slot otherwise, feeds the result to
the placeholders, and pins whatever it resolved back onto `[theme.custom]` for
the tokens the theme did not declare. So the dot and the agent rows under it
always come from one value, whether or not the theme said anything.

That pinning is not redundant with the slot rule. Herdr resolves its own tokens
from the terminal theme independently, and on a light background it does not
reach the same slots `tt` does, so a dot and the row under it were free to differ
by a shade. Declaring the token is now the only thing that decides.

Pinned keys are appended bare at the end of the generated config, which means
they land in whatever table the theme fragment ended in. That is why the fragment
must declare `[theme.custom]` and nothing after it; `tt` checks and refuses
rather than quietly moving Herdr's colors into another table.

A fourth row color is not a state color. An agent that finished and has been
looked at is `idle` in Herdr's vocabulary, and Herdr draws its dot in a muted
tone rather than a state one, so a row left in the ordinary foreground came out
louder than the dot beside it. `tt` fills `@idle` from `subtext0`:

* `subtext0 = "#RRGGBB"` for the muted tone

Aim for roughly 4.5:1 against the theme background, well under the foreground's
own contrast, so a finished space recedes without going unreadable. A theme that
declares none falls back to the theme's own `foreground`, which is what every row
was before this existed, so themes that say nothing are unaffected.

Herdr does not document whether its idle icon resolves to `subtext0` or to
`overlay1`, so a theme that wants the dot to follow gives both the same value.
They are adjacent muted tiers and nothing in this sidebar depends on the
difference. `overlay0` is not one of them and stays where the theme tuned it.

Take the replacement from the colorscheme's own extended palette rather than
inventing one. Where nothing in that palette both reads right and holds contrast,
move one of its colors along a single axis and say which: lightness buys contrast
without walking the hue, and most colorschemes already ship variants derived the
same way. Say in the comment which two colors were colliding and what the
replacement buys.

kanso-pearl is the case that earned this. Its yellow `#77713F` and its green
`#6F894E` sit 33 degrees of hue apart at the same lightness and the same low
saturation, close enough that a working row and a done row read alike. Its
extended palette offers no drop-in: `pearlYellow2` is a brown, `pearlOrange` is
an orange, and `pearlYellow3` is the right hue but sits at 2.1:1 here. On a paper
background a yellow has to be light to stay yellow, and light is what costs the
contrast, so its `yellow` is `pearlYellow3` taken down to 34% lightness with its
hue and saturation untouched.

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

1. Create `themes/<name>/ghostty.conf`, `nvim.lua`, and `herdr.toml`.
2. Add the Neovim plugin only if no existing plugin provides the colorscheme.
3. Mirror the Ghostty palette to `tt/.config/ghostty/themes/terminal-<name>`. It
   belongs to the `tt` package, not `ghostty`, so `macos/dotfiles/tt` restows it.
4. Add a static `# wallpaper-color = #RRGGBB` to `ghostty.conf` and its mirror.
5. Run `tt <name>` or choose it with `tt`.
6. Open Herdr and verify sidebar contrast, the navigate cursor, and active vs
   inactive pane borders.
7. Open Neovim and verify startup has no Lazy errors.
