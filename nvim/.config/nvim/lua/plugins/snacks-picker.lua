return {
  "folke/snacks.nvim",
  opts = { picker = { win = { input = { keys = { ["<Esc>"] = { "close", mode = { "n", "i" } } } } } } },
  keys = {
    {
      "<leader><leader>",
      function()
        require("snacks").picker.smart({ hidden = true })
      end,
      desc = "Open file picker",
    },
    {
      "<leader>/",
      function()
        require("snacks").picker.grep({ hidden = true })
      end,
      desc = "Open grep",
    },
    {
      "<leader>r",
      function()
        require("snacks").picker.resume()
      end,
      desc = "Resume last picker",
    },
    {
      "<leader>N",
      function()
        require("snacks").picker.notifications()
      end,
      desc = "Open notifications picker",
    },
  },
}
