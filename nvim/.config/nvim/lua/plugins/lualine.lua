local statusline = require("config.statusline")

return {
  "nvim-lualine/lualine.nvim",
  init = function()
    statusline.setup_macro_recording_refresh()
  end,
  opts = {
    options = {
      component_separators = "",
      section_separators = "",
    },
    sections = {
      lualine_a = { "mode", statusline.macro_recording },
      lualine_b = { "branch", "diagnostics" },
      lualine_c = { { "filename", path = 1, shortening_target = 40 } },
      lualine_x = { "encoding", "fileformat" },
      lualine_y = { "filetype" },
      lualine_z = { "location" },
    },
  },
}
