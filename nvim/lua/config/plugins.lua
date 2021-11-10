vim.cmd [[packadd packer.nvim]]

return require("packer").startup(
  function()
    -- # package manager --
    use "wbthomason/packer.nvim"

    -- # init.lua config helper --
    use "svermeulen/vimpeccable"

    -- # status line --
    use {
      "nvim-lualine/lualine.nvim",
      requires = {"kyazdani42/nvim-web-devicons", opt = true}
    }

    -- # colorscheme --
    use {
      "projekt0n/github-nvim-theme",
      config = function()
        require("github-theme").setup(
          {
            theme_style = "light"
          }
        )
      end
    }

    -- # file finder and more --
    use {
      "nvim-telescope/telescope.nvim",
      requires = {{"nvim-lua/plenary.nvim"}}
    }
    use "kyazdani42/nvim-web-devicons"

    -- # file explorer --
    use {
      "kyazdani42/nvim-tree.lua",
      config = function()
        require("nvim-tree").setup()
      end
    }

    -- # colors --
    use {
      "nvim-treesitter/nvim-treesitter",
      run = ":TSUpdate"
    }
    use {
      "nvim-treesitter/nvim-treesitter-textobjects",
      branch = "0.5-compat"
    }
    use "sheerun/vim-polyglot"

    -- # lsp --
    use "neovim/nvim-lspconfig"

    -- # completion --
    use "hrsh7th/cmp-nvim-lsp"
    use "hrsh7th/cmp-buffer"
    use "hrsh7th/nvim-cmp"

    -- # code formatting --
    use "mhartington/formatter.nvim"

    -- # git client --
    use "tpope/vim-fugitive"

    -- # auto pairs --
    use "jiangmiao/auto-pairs"

    -- # comments --
    use {
      "numToStr/Comment.nvim",
      config = function()
        require("Comment").setup()
      end
    }

    -- # snippets --
    use "L3MON4D3/LuaSnip"

    -- # CSS colors --
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

    -- # git gutter --
    use {
      "lewis6991/gitsigns.nvim",
      requires = {"nvim-lua/plenary.nvim"},
      config = function()
        require("gitsigns").setup()
      end
    }

    -- # buffer manager --
    use {
      "ThePrimeagen/harpoon",
      requires = {"nvim-lua/plenary.nvim"},
      config = function()
        require("harpoon").setup()
      end
    }

    -- # line/word finder --
    use {
      "phaazon/hop.nvim",
      branch = "v1"
    }
  end
)
