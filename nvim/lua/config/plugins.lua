vim.cmd [[packadd packer.nvim]]

return require("packer").startup(
  function()
    -- Packer can manage itself
    use "wbthomason/packer.nvim"

    -- init.lua config helper
    use "svermeulen/vimpeccable"

    -- status line
    use {
      "nvim-lualine/lualine.nvim",
      requires = {"kyazdani42/nvim-web-devicons", opt = true}
    }

    -- colorscheme
    use {
      "projekt0n/github-nvim-theme",
      config = function()
        require("github-theme").setup(
          {
            theme_style = "light_default"
          }
        )
      end
    }

    -- Telescope
    use {
      "nvim-telescope/telescope.nvim",
      requires = {{"nvim-lua/plenary.nvim"}}
    }
    use "kyazdani42/nvim-web-devicons"

    -- Explorer
    use {
      "kyazdani42/nvim-tree.lua",
      config = function()
        require("nvim-tree").setup()
      end
    }

    -- Treesitter
    use {
      "nvim-treesitter/nvim-treesitter",
      run = ":TSUpdate"
    }
    use {
      "nvim-treesitter/nvim-treesitter-textobjects",
      branch = "0.5-compat"
    }
    use "sheerun/vim-polyglot"

    -- LSP
    use "neovim/nvim-lspconfig"

    -- Completion
    use "hrsh7th/cmp-nvim-lsp"
    use "hrsh7th/cmp-buffer"
    use "hrsh7th/nvim-cmp"

    -- Formatting
    use "mhartington/formatter.nvim"

    -- Fugitive
    use "tpope/vim-fugitive"

    -- Auto-pairs
    use "jiangmiao/auto-pairs"

    -- comments
    use {
      "numToStr/Comment.nvim",
      config = function()
        require("Comment").setup()
      end
    }

    -- Snippets
    use "L3MON4D3/LuaSnip"

    -- CSS colors
    use {
      "norcalli/nvim-colorizer.lua",
      config = function()
        require("colorizer").setup {
          "css",
          "html",
          "javascript",
          "sass",
          "scss"
        }
      end
    }

    -- git gutter
    use {
      "lewis6991/gitsigns.nvim",
      requires = {"nvim-lua/plenary.nvim"},
      config = function()
        require("gitsigns").setup()
      end
    }

    -- harpoon
    use {
      "ThePrimeagen/harpoon",
      requires = {"nvim-lua/plenary.nvim"},
      config = function()
        require("harpoon").setup()
      end
    }

    -- hop
    use {
      "phaazon/hop.nvim",
      branch = "v1",
      config = function()
        require("hop").setup()
      end
    }
  end
)
