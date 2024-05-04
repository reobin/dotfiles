local plugins = {
  require "plugins.configs.colorscheme",
  require "plugins.configs.neo-tree",
  require "plugins.configs.treesitter",
  "tpope/vim-fugitive",
  "github/copilot.vim",
  require "plugins.configs.telescope",
  require "plugins.configs.formatter",
}

require("lazy").setup(plugins, require "plugins.configs.lazy")
