return {
  "tpope/vim-fugitive",
  config = function()
    vim.keymap.set("n", "<leader>gs", vim.cmd.Git)
    vim.keymap.set("n", "<leader>gb", function()
      vim.cmd.Git("blame")
    end)
    vim.keymap.set("n", "<leader>gl", function()
      vim.cmd.Git("log")
    end)
  end,
}
