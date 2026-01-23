return {
  "folke/snacks.nvim",
  opts = { picker = { win = { input = { keys = { ["<Esc>"] = { "close", mode = { "n", "i" } } } } } } },
  keys = {
    {
      "<leader>p",
      function()
        require("snacks").picker.smart({ hidden = true })
      end
    },
    {
      "<leader>s",
      function()
        require("snacks").picker.grep({ hidden = true })
      end
    },
    {
      "<leader>r",
      function()
        require("snacks").picker.resume()
      end
    },
    {
      "<leader>b",
      function()
        require("snacks").picker.buffers()
      end
    }
  }
}
