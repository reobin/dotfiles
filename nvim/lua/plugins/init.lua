local plugins = {
  require("plugins.configs.colorscheme"),
  require("plugins.configs.treesitter"),
  require("plugins.configs.cmp"),
  require("plugins.configs.lsp"),
  "github/copilot.vim",
  require("plugins.configs.fugitive"),
  require("plugins.configs.gitsigns"),
  require("plugins.configs.snacks"),
  require("plugins.configs.oil"),
  require("plugins.configs.formatter"),
  require("plugins.configs.quickfix"),
  require("plugins.configs.mini"),
  "vimcolorschemes/extractor.nvim",
}

require("lazy").setup(plugins, require("plugins.configs.lazy-load"))
