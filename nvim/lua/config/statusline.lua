local lualine = require("lualine")

lualine.setup(
  {
    options = {
      theme = "github",
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
            added = {fg = "green"},
            modified = {fg = "orange"},
            removed = {fg = "darkred"}
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
