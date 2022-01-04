treesitter_languages = {
  "go",
  "javascript",
  "lua",
  "tsx",
  "typescript",
  "python"
}

local treesitter = require("nvim-treesitter.configs")

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true,
    disable = {"elixir"}
  }
}
