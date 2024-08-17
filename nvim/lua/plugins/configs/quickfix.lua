return {
  "stevearc/quicker.nvim",
  event = "FileType qf",
  config = function()
    local quicker = require("quicker")
    quicker.setup()

    vim.keymap.set("n", "<leader>q", quicker.toggle, { desc = "Toggle quickfix" })

    quicker.setup({
      keys = {
        {
          ">",
          function()
            quicker.expand({ before = 2, after = 2, add_to_existing = true })
          end,
          desc = "Expand quickfix context",
        },
        { "<", quicker.collapse, desc = "Collapse quickfix context" },
      },
    })
  end,
}
