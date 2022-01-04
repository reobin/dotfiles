treesitter_languages = {
  "go",
  "javascript",
  "lua",
  "tsx",
  "typescript",
  "python",
  "elixir"
}

local treesitter = require("nvim-treesitter.configs")

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true
  }
}
