return {
  "stevearc/oil.nvim",
  dependencies = { "echasnovski/mini.icons" },
  config = function()
    require("mini.icons").setup()
    require("oil").setup({
      default_file_explorer = true,
      view_options = { show_hidden = true },
    })
    vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory" })
  end,
}
