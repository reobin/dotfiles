return {
  "tpope/vim-fugitive",
  cmd = { "Git", "G" },
  keys = {
    { "<leader>gg", "<cmd>Git ++curwin<cr>", desc = "Git status" },
  },
}
