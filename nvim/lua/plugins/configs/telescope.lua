return {
  "nvim-telescope/telescope.nvim",
  tag = "0.1.6",
  dependencies = { "nvim-lua/plenary.nvim" },
  config = function()
    require("telescope").setup {
      defaults = {
        mappings = {
          i = {
            ["<ESC>"] = require("telescope.actions").close,
          },
        },
      },
    }
  end,
}
