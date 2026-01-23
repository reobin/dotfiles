return {
  "stevearc/oil.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    default_file_explore = true,
    skip_confirm_for_simple_edits = true,
    view_options = {
      show_hidden = true
    }
  },
  keys = {
    { "=", "<cmd>Oil<cr>" }
  }
}
