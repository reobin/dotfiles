return {
  "mellow-theme/mellow.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    vim.cmd.colorscheme("mellow")
  end,
}
