vim.cmd [[packadd packer.nvim]]

return require("packer").startup(
  function()
    -- Packer can manage itself
    use "wbthomason/packer.nvim"

    -- init.lua config helper
    use "svermeulen/vimpeccable"

    -- colorscheme
    use "sainnhe/edge"

    -- Telescope
    use {
      "nvim-telescope/telescope.nvim",
      requires = {{"nvim-lua/plenary.nvim"}}
    }
    use "kyazdani42/nvim-web-devicons"

    -- Explorer
    use "kyazdani42/nvim-tree.lua"

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

    -- Commentary
    use "tpope/vim-commentary"

    -- Snippets
    use "L3MON4D3/LuaSnip"

    -- CSS colors
    use "norcalli/nvim-colorizer.lua"

    -- git gutter
    use {
      "lewis6991/gitsigns.nvim",
      requires = {"nvim-lua/plenary.nvim"}
    }

    -- status line
    use "itchyny/lightline.vim"

    -- harpoon
    use {
      "ThePrimeagen/harpoon",
      requires = {"nvim-lua/plenary.nvim"}
    }

    -- hop
    use {
      "phaazon/hop.nvim",
      branch = "v1"
    }
  end
)
