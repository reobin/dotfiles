return {
  "lewis6991/gitsigns.nvim",
  config = function()
    require("gitsigns").setup()
    vim.keymap.set("n", "<leader>gj", ":Gitsigns next_hunk<cr>")
    vim.keymap.set("n", "<leader>gk", ":Gitsigns prev_hunk<cr>")
    vim.keymap.set("n", "<leader>t", ":Gitsigns stage_hunk<cr>")
    vim.keymap.set("n", "<leader>u", ":Gitsigns undo_stage_hunk<cr>")
  end,
}
