local plugins = {
  require "plugins.configs.colorscheme",
  require "plugins.configs.treesitter",
  require "plugins.configs.lsp",
  "github/copilot.vim",
  require "plugins.configs.fugitive",
  require "plugins.configs.gitsigns",
  require "plugins.configs.telescope",
  require "plugins.configs.neo-tree",
  require "plugins.configs.replacer",
  require "plugins.configs.formatter",
  require "plugins.configs.harpoon",
  require "plugins.configs.autopairs",
  require "plugins.configs.global-note",
}

require("lazy").setup(plugins, require "plugins.configs.lazy")
