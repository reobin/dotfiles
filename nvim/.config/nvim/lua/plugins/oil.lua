return {
  "stevearc/oil.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    default_file_explore = true,
    skip_confirm_for_simple_edits = true,
    float = {
      max_width = 0.9,
      max_height = 0.9,
      border = "rounded",
    },
    keymaps = {
      ["q"] = "actions.close",
      ["="] = "actions.parent",
    },
    view_options = {
      show_hidden = true,
    },
  },
  keys = {
    { "=", "<cmd>Oil --float<cr>" },
  },
}
