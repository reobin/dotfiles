local lualine = require("lualine")

lualine.setup(
  {
    options = {
      theme = "auto",
      component_separators = "|",
      section_separators = ""
    },
    sections = {
      lualine_a = {{"mode"}},
      lualine_b = {{"filename", path = 1}, "branch"},
      lualine_c = {
        {
          "diff",
          symbols = {added = " ", modified = "⦿ ", removed = " "},
          diff_color = {
            added = {fg = "#8cc85f"},
            modified = {fg = "#e3c78a"},
            removed = {fg = "#ff5454"}
          }
        }
      },
      lualine_x = {},
      lualine_y = {"filetype", "progress"},
      lualine_z = {{"location"}}
    },
    inactive_sections = {
      lualine_a = {"filename"},
      lualine_b = {},
      lualine_c = {},
      lualine_x = {},
      lualine_y = {},
      lualine_z = {"location"}
    },
    tabline = {},
    extensions = {}
  }
)
