return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true },
    picker = { win = { input = { keys = { ["<Esc>"] = { "close", mode = { "n", "i" } } } } } },
    scratch = { ft = "markdown", file = vim.fn.expand("~") .. "/Documents/notes/scratch.md" },
  },
  keys = {
    {
      "<leader>n",
      function()
        require("snacks").scratch()
      end,
    },
    {
      "<leader>p",
      function()
        require("snacks").picker.smart({ hidden = true })
      end,
    },
    {
      "<leader>s",
      function()
        require("snacks").picker.grep({ hidden = true })
      end,
    },
    {
      "<leader>r",
      function()
        require("snacks").picker.resume()
      end,
    },
    {
      "<leader>gp",
      function()
        require("snacks").git.blame_line()
      end,
    },
  },
}
