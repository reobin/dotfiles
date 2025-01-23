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
        require("snacks").picker.files()
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
  },
}
