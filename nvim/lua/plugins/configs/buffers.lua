return {
  "Pheon-Dev/buffalo-nvim",
  dependencies = { "nvim-lua/plenary.nvim" },
  config = function()
    local buffalo = require("buffalo")
    buffalo.setup({
      ui = {
        width = 80,
        height = 20,
        row = 2,
        col = 2,
        borderchars = { "─", "│", "─", "│", "╭", "╮", " ", " " },
      },
    })

    local ui = require("buffalo.ui")
    vim.keymap.set("n", "<leader>b", ui.toggle_buf_menu)
  end,
}
