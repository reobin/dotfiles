return {
  "barrettruth/canola.nvim",
  main = "oil",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = function()
    return {
      default_file_explore = true,
      skip_confirm_for_simple_edits = true,
      float = {
        max_width = 0.9,
        max_height = 0.9,
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
    }
  end,
  lazy = false,
  keys = {
    { "<leader>e", "<cmd>Canola --float<cr>", desc = "Open Canola (float)" },
  },
}
