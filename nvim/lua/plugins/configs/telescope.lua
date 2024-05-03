require("telescope").setup {
  defaults = {
    mappings = {
      i = {
        ["<ESC>"] = require("telescope.actions").close,
      },
    },
  },
}
