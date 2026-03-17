return {
  "stevearc/oil.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    default_file_explore = true,
    skip_confirm_for_simple_edits = true,
    float = {
      max_width = 0.6,
      max_height = 0.6,
      border = "rounded",
    },
    keymaps = {
      ["q"] = "actions.close",
      ["-"] = "actions.parent",
      ["<leader>e"] = "actions.close",
    },
    view_options = {
      show_hidden = true,
    },
  },
  keys = {
    { "<leader>e", "<cmd>Oil --float<cr>", desc = "Open Oil (float)" },
  },
}
