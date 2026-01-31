return {
  "nvim-lualine/lualine.nvim",
  opts = {
    options = {
      component_separators = "",
      section_separators = "",
    },
    sections = {
      lualine_a = { "mode" },
      lualine_b = { "branch", "diagnostics" },
      lualine_c = { { "filename", path = 1, shortening_target = 40 } },
      lualine_x = { "encoding", "fileformat" },
      lualine_y = { "filetype" },
      lualine_z = { "location" },
    },
  },
}
