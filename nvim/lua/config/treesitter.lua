treesitter_languages = {
  "go",
  "javascript",
  "lua",
  "tsx",
  "typescript"
}

polyglot_languages = {
  "elixir",
  "python"
}

local treesitter = require("nvim-treesitter.configs")

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true,
    disable = polyglot_languages
  }
}

vim.g.polyglot_disabled = treesitter_languages
