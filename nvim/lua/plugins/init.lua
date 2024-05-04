local plugins = {
  require "plugins.configs.colorscheme",
  require "plugins.configs.neo-tree",
  require "plugins.configs.treesitter",
  require "plugins.configs.cmp",
  require "plugins.configs.mason",
  require "plugins.configs.lsp",
  "tpope/vim-fugitive",
  "github/copilot.vim",
  require "plugins.configs.telescope",
  require "plugins.configs.formatter",
  require "plugins.configs.comments",
}

require("lazy").setup(plugins, require "plugins.configs.lazy")
