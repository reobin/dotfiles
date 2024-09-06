return {
  "EdenEast/nightfox.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    require("nightfox").setup({
      groups = { all = { NormalFloat = { bg = "none" } } },
    })
    vim.cmd("colorscheme carbonfox")
  end,
}
