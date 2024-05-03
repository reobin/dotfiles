local plugins = {
  {
    "sainnhe/sonokai",
    lazy = false,
    priority = 1000,
    config = function()
      vim.cmd.colorscheme "sonokai"
    end,
  },
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    },
  },
  "tpope/vim-fugitive",
  "github/copilot.vim",
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.6",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      require("plugins.configs.telescope")
    end,
  },
  {
    "stevearc/conform.nvim",
    config = function()
      require "plugins.configs.conform"
    end,
  },
}

require("lazy").setup(plugins, require "plugins.configs.lazy")
