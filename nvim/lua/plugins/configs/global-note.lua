return {
  "backdround/global-note.nvim",
  config = function()
    local global_note = require "global-note"
    global_note.setup { directory = "~/Documents/notes/" }
    vim.keymap.set("n", "<leader>n", global_note.toggle_note)
  end,
}
