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
    use "rebelot/kanagawa.nvim"

    -- # file finder and more --
    use {
      "nvim-telescope/telescope.nvim",
      requires = {{"nvim-lua/plenary.nvim"}}
    }
    use "kyazdani42/nvim-web-devicons"

    -- # colors --
    use {
      "nvim-treesitter/nvim-treesitter",
      run = ":TSUpdate"
    }
    use "nvim-treesitter/nvim-treesitter-textobjects"

    -- # lsp --
    use "neovim/nvim-lspconfig"

    -- # completion --
    use "hrsh7th/cmp-nvim-lsp"
    use "hrsh7th/cmp-buffer"
    use "hrsh7th/cmp-path"
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
    use "saadparwaiz1/cmp_luasnip"

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

    -- # file explorer --
    use {
      "nvim-neo-tree/neo-tree.nvim",
      branch = "v2.x",
      requires = {
        "nvim-lua/plenary.nvim",
        "kyazdani42/nvim-web-devicons",
        "MunifTanjim/nui.nvim"
      },
      config = function()
        vim.cmd([[ let g:neo_tree_remove_legacy_commands = 1 ]])

        vim.fn.sign_define("DiagnosticSignError", {text = " ", texthl = "DiagnosticSignError"})
        vim.fn.sign_define("DiagnosticSignWarn", {text = " ", texthl = "DiagnosticSignWarn"})
        vim.fn.sign_define("DiagnosticSignInfo", {text = " ", texthl = "DiagnosticSignInfo"})
        vim.fn.sign_define("DiagnosticSignHint", {text = "", texthl = "DiagnosticSignHint"})

        require("neo-tree").setup(
          {
            close_if_last_window = false,
            popup_border_style = "rounded",
            enable_git_status = true,
            enable_diagnostics = true,
            default_component_configs = {
              indent = {
                indent_size = 2,
                padding = 1,
                with_markers = true,
                indent_marker = "│",
                last_indent_marker = "└",
                highlight = "NeoTreeIndentMarker",
                with_expanders = nil,
                expander_collapsed = "",
                expander_expanded = "",
                expander_highlight = "NeoTreeExpander"
              },
              icon = {
                folder_closed = "",
                folder_open = "",
                folder_empty = "ﰊ",
                default = "*"
              },
              modified = {
                symbol = "[+]",
                highlight = "NeoTreeModified"
              },
              name = {
                trailing_slash = false,
                use_git_status_colors = true
              },
              git_status = {
                symbols = {
                  added = "",
                  modified = "!",
                  deleted = "—",
                  renamed = "»",
                  untracked = "?",
                  ignored = "",
                  unstaged = "",
                  staged = "+",
                  conflict = ""
                }
              }
            },
            window = {
              position = "float"
            },
            filesystem = {
              filtered_items = {
                visible = false,
                hide_dotfiles = false,
                hide_gitignored = true
              },
              follow_current_file = true,
              hijack_netrw_behavior = "open_default",
              use_libuv_file_watcher = false
            },
            buffers = {
              show_unloaded = true,
              window = {
                mappings = {
                  ["bd"] = "buffer_delete"
                }
              }
            },
            git_status = {
              window = {
                mappings = {
                  ["gA"] = "git_add_all",
                  ["gu"] = "git_unstage_file",
                  ["ga"] = "git_add_file",
                  ["gr"] = "git_revert_file",
                  ["gc"] = "git_commit",
                  ["gp"] = "git_push"
                }
              }
            }
          }
        )
      end
    }
  end
)
