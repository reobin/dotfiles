-- kanagawa.nvim ships Wave on its own #1F1F28 and writes in fujiWhite. Both
-- belong to the theme rather than to the plugin spec, so they travel as globals
-- the spec reads back. The ink is kanso-zen's, matching ghostty.conf's 15 and 7.
return {
  colorscheme = "kanagawa-wave",
  globals = {
    kanagawa_ground = "#090E13",
    kanagawa_palette = {
      fujiWhite = "#C5C9C7",
      oldWhite = "#A4A7A4",
    },
  },
}
