return {
  "Pheon-Dev/buffalo-nvim",
  config = function()
    local buffalo = require("buffalo.ui")
    vim.keymap.set("n", "<leader>b", buffalo.toggle_buf_menu)
  end,
}
