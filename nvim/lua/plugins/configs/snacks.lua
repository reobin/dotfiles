return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    picker = { win = { input = { keys = { ["<Esc>"] = { "close", mode = { "n", "i" } } } } } },
    scratch = {
      ft = "markdown",
      root = vim.fn.expand("~") .. "/Documents/scratch",
      filekey = { count = true, cwd = false, branch = false },
    },
  },
  keys = {
    {
      "<leader>n",
      function()
        require("snacks").scratch()
      end,
    },
    {

      "<leader>S",
      function()
        require("snacks").scratch.select()
      end,
    },
    {
      "<leader>p",
      function()
        require("snacks").picker.files({ hidden = true })
      end,
    },
    {
      "<leader>s",
      function()
        require("snacks").picker.grep()
      end,
    },
    {
      "<leader>r",
      function()
        require("snacks").picker.resume()
      end,
    },
    {
      "<leader>gb",
      function()
        require("snacks").picker.git_branches()
      end,
    },
    {
      "<leader>gp",
      function()
        require("snacks").picker.git_diff()
      end,
    },
    {
      "<leader>b",
      function()
        require("snacks").picker.buffers()
      end,
    },
  },
}
