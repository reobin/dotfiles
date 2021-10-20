vim.cmd [[packadd packer.nvim]]

return require("packer").startup(
  function()
    -- Packer can manage itself
    use "wbthomason/packer.nvim"

    -- init.lua config helper
    use "svermeulen/vimpeccable"

    -- colorscheme
    use "bluz71/vim-moonfly-colors"

    -- Telescope
    use {
      "nvim-telescope/telescope.nvim",
      requires = {{"nvim-lua/plenary.nvim"}}
    }
    use "kyazdani42/nvim-web-devicons"

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
  end
)
