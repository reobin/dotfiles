return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    picker = { win = { input = { keys = { ["<Esc>"] = { "close", mode = { "n", "i" } } } } } },
  },
  keys = {
    {
      "<leader>p",
      function()
        Snacks.picker.files()
      end,
    },
    {
      "<leader>s",
      function()
        Snacks.picker.grep()
      end,
    },
    {
      "<leader>r",
      function()
        Snacks.picker.resume()
      end,
    },
    {
      "<leader>gb",
      function()
        Snacks.picker.git_branches()
      end,
    },
    {
      "<leader>gp",
      function()
        Snacks.picker.git_diff()
      end,
    },
  },
}
