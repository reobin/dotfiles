return {
  "aidancz/buvvers.nvim",
  config = function()
    require("buvvers").setup({
      name_prefix = function()
        return "• "
      end,
    })
    require("buvvers").open()
    vim.keymap.set("n", "<leader>b", require("buvvers").toggle, { desc = "Toggle buffers" })
  end,
}
