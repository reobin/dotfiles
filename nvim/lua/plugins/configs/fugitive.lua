return {
  "tpope/vim-fugitive",
  config = function()
    vim.keymap.set("n", "<leader>gs", ":enew | Git | only<cr>")
    vim.keymap.set("n", "<leader>gb", ":Git blame<cr>")

    vim.keymap.set("n", "dv", ":Gvdiffsplit!<cr>")
    vim.keymap.set("n", "dh", ":diffget //2<cr>")
    vim.keymap.set("n", "dl", ":diffget //3<cr>")
  end,
}
