return {
  "tpope/vim-fugitive",
  cmd = { "Git", "G", "Gdiffsplit", "Gread", "Gwrite", "Gstatus" },
  keys = {
    {
      "<leader>gg",
      function()
        vim.cmd("Git ++curwin")
      end,
      desc = "Git (Fugitive)",
    },
  },
}
