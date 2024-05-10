local plugins = {
  require "plugins.configs.colorscheme",
  require "plugins.configs.treesitter",
  require "plugins.configs.lsp",
  require "plugins.configs.fugitive",
  require "plugins.configs.gitsigns",
  "github/copilot.vim",
  require "plugins.configs.telescope",
  require "plugins.configs.formatter",
  require "plugins.configs.harpoon",
  require "plugins.configs.autopairs",
  require "plugins.configs.global-note",
  require "plugins.configs.hardtime",
}

require("lazy").setup(plugins, require "plugins.configs.lazy")
