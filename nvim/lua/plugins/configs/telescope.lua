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
        hidden = true,
        file_ignore_patterns = { "^.git" },
      },
    }
    vim.keymap.set("n", "<leader>p", ":Telescope find_files find_command=rg,--hidden,--ignore,--files<cr>")
    vim.keymap.set("n", "<leader>s", ":Telescope live_grep<cr>")
    vim.keymap.set("n", "<leader>r", ":Telescope resume<cr>")
  end,
}
