return {
  "tpope/vim-fugitive",
  config = function()
    vim.keymap.set("n", "<leader>gs", ":Git<cr>")
    vim.keymap.set("n", "<leader>gb", ":Git blame<cr>")
    vim.keymap.set("n", "<leader>gl", ":Git log<cr>")

    vim.keymap.set("n", "<leader>gc", ":Gvdiffsplit!")
    vim.keymap.set("n", "<leader>gh", ":diffget //2<cr>")
    vim.keymap.set("n", "<leader>gl", ":diffget //3<cr>")
  end,
}
