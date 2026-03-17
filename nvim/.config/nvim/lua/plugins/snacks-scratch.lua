return {
  "folke/snacks.nvim",
  opts = {
    scratch = { ft = "markdown", file = vim.fn.expand("~") .. "/Documents/notes/scratch.md" },
  },
  keys = {
    {
      "<leader>n",
      function()
        require("snacks").scratch()
      end,
      desc = "Open quick note"
    },
  },
}
