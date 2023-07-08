vim.cmd [[packadd packer.nvim]]

local packer_group = vim.api.nvim_create_augroup("Packer", {clear = true})
vim.api.nvim_create_autocmd(
  "BufWritePost",
  {command = "source <afile> | PackerCompile", group = packer_group, pattern = "init.lua"}
)

require("packer").startup(
  function(use)
    -- general
    use "wbthomason/packer.nvim"
    use "numToStr/Comment.nvim"
    use "nvim-lualine/lualine.nvim"
    use "mhartington/formatter.nvim"
    use "jiangmiao/auto-pairs"

    -- git
    use "tpope/vim-fugitive"
    use {"lewis6991/gitsigns.nvim", requires = {"nvim-lua/plenary.nvim"}}

    -- syntax highlight and navigation
    use "nvim-treesitter/nvim-treesitter"
    use "nvim-treesitter/nvim-treesitter-textobjects"

    -- LSP + cmp
    use "neovim/nvim-lspconfig"
    use "williamboman/nvim-lsp-installer"
    use "hrsh7th/nvim-cmp"
    use "hrsh7th/cmp-nvim-lsp"
    use "hrsh7th/cmp-path"
    use "hrsh7th/cmp-buffer"
    use "saadparwaiz1/cmp_luasnip"
    use "L3MON4D3/LuaSnip"
    use "github/copilot.vim"

    -- file finders
    use {
      "nvim-neo-tree/neo-tree.nvim",
      branch = "v2.x",
      requires = {"nvim-lua/plenary.nvim", "kyazdani42/nvim-web-devicons", "MunifTanjim/nui.nvim"}
    }
    use {"nvim-telescope/telescope.nvim", requires = {"nvim-lua/plenary.nvim"}}
    use {"nvim-telescope/telescope-fzf-native.nvim", run = "make"}

    -- linter
    use {
      "folke/trouble.nvim",
      requires = "kyazdani42/nvim-web-devicons",
      config = function()
        require("trouble").setup {}
      end
    }
  end
)

vim.o.autoindent = true -- Copy indent from current line
vim.o.tabstop = 2 -- Number of spaces that a <Tab> counts for
vim.o.shiftwidth = vim.o.tabstop -- The amount of indent added
vim.o.expandtab = true -- Insert spaces with the <Tab> key

vim.o.relativenumber = true -- Use relative number on gutter
vim.o.hidden = true -- Do not unload buffers when switching
vim.o.signcolumn = "yes" -- Always show sign column
vim.o.cursorline = true -- Highlight current line

vim.o.completeopt = "menuone,noselect"

vim.o.termguicolors = true
vim.cmd [[
  colorscheme lunaperche 
  set background=light
]]

-- copilot
vim.g.copilot_filetypes = {markdown = true}

-- statusbar
require("lualine").setup {
  options = {
    icons_enabled = false,
    theme = "onelight",
    path = 3,
    component_separators = " ",
    section_separators = ""
  }
}

-- leader key
vim.keymap.set({"n", "v"}, "<Space>", "<Nop>", {silent = true})
vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.keymap.set("n", "<leader>l", "<C-^>") -- open last buffer
vim.keymap.set("x", "<leader>c", '"*y') -- copy visual selection to clipboard
vim.keymap.set("n", "<leader>/", ":noh<cr>") -- remove search highlight
vim.keymap.set("n", "<C-u>", "<C-u>zz") -- scroll up half page and center cursor
vim.keymap.set("n", "<C-d>", "<C-d>zz") -- scroll down half page and center cursor
vim.keymap.set("n", "n", "nzz") -- search result and center cursor
vim.keymap.set("n", "N", "Nzz") -- search result and center cursor

-- highlight on yank
local highlight_group = vim.api.nvim_create_augroup("YankHighlight", {clear = true})
vim.api.nvim_create_autocmd(
  "TextYankPost",
  {
    callback = function()
      vim.highlight.on_yank()
    end,
    group = highlight_group,
    pattern = "*"
  }
)

-- comments
require("Comment").setup()

-- git
require("gitsigns").setup {
  signs = {
    add = {text = "+"},
    change = {text = "~"},
    delete = {text = "_"},
    topdelete = {text = "‾"},
    changedelete = {text = "~"}
  }
}

vim.keymap.set("n", "<leader>gs", ":Git<cr>")
vim.keymap.set("n", "<leader>gd", ":Gitsigns diffthis<cr>")
vim.keymap.set("n", "<leader>gj", ":Gitsigns next_hunk<cr>")
vim.keymap.set("n", "<leader>gk", ":Gitsigns prev_hunk<cr>")
vim.keymap.set("n", "<leader>gp", ":Gitsigns preview_hunk<cr>")
vim.keymap.set("n", "<leader>gr", ":Gitsigns reset_hunk<cr>")
vim.keymap.set("n", "<leader>ga", ":Gitsigns stage_hunk<cr>")
vim.keymap.set("n", "<leader>gu", ":Gitsigns undo_stage_hunk<cr>")

-- telescope
local telescope = require("telescope")
local telescope_actions = require("telescope.actions")
local telescope_builtin = require("telescope.builtin")

telescope.setup {
  defaults = {
    mappings = {
      i = {["<ESC>"] = telescope_actions.close}
    },
    preview = {
      treesitter = {
        "go",
        "javascript",
        "lua",
        "tsx",
        "typescript",
        "python"
      }
    }
  }
}

telescope.load_extension "fzf"

vim.keymap.set("n", "<leader>s", telescope_builtin.live_grep)
vim.keymap.set("n", "<leader>p", telescope_builtin.find_files)
vim.keymap.set("n", "<leader><leader>d", telescope_builtin.lsp_definitions)

-- LSP keymaps
vim.keymap.set("n", "<leader><leader>h", vim.lsp.buf.hover)
vim.keymap.set("n", "<leader><leader>r", vim.lsp.buf.rename)

-- Trouble
vim.keymap.set("n", "<leader>tt", ":TroubleToggle<cr>")
vim.keymap.set("n", "<leader>tf", ":TroubleToggle quickfix<cr>")

-- neo-tree
vim.fn.sign_define("DiagnosticSignError", {text = " ", texthl = "DiagnosticSignError"})
vim.fn.sign_define("DiagnosticSignWarn", {text = " ", texthl = "DiagnosticSignWarn"})
vim.fn.sign_define("DiagnosticSignInfo", {text = " ", texthl = "DiagnosticSignInfo"})
vim.fn.sign_define("DiagnosticSignHint", {text = "", texthl = "DiagnosticSignHint"})

require("neo-tree").setup(
  {
    popup_border_style = "single",
    filesystem = {filtered_items = {visible = true}},
    use_default_mappings = true
  }
)

vim.keymap.set("n", "<leader>e", ":Neotree focus toggle position=float reveal=true<cr>")
vim.keymap.set("n", "<leader>b", ":Neotree focus toggle position=float source=buffers<cr>")
vim.keymap.set("n", "<leader>h", ":Neotree focus toggle position=float source=git_status<cr>")

-- treesitter configuration
require("nvim-treesitter.configs").setup {
  highlight = {enable = true},
  indent = {enable = true}
}

-- LSP + cmp
require("nvim-lsp-installer").setup({automatic_installation = true})

local lspconfig = require("lspconfig")

-- nvim-cmp supports additional completion capabilities
local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities = require("cmp_nvim_lsp").default_capabilities(capabilities)

-- Enable the following language servers
local servers = {"gopls", "elixirls", "eslint", "tsserver", "volar", "omnisharp"}
for _, lsp in ipairs(servers) do
  lspconfig[lsp].setup {
    capabilities = capabilities
  }
end

vim.cmd [[
  if did_filetype()
      finish
  endif
  if getline(1) =~# '^#!.*/bin/env\s\+elixir\>'
      setfiletype elixir
  endif
]]

vim.keymap.set("n", "<leader><leader>h", vim.lsp.buf.hover)

-- luasnip setup
local luasnip = require("luasnip")

-- nvim-cmp setup
local cmp = require("cmp")
cmp.setup {
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end
  },
  mapping = cmp.mapping.preset.insert(
    {
      ["<C-Space>"] = cmp.mapping.complete(),
      ["<CR>"] = cmp.mapping.confirm {behavior = cmp.ConfirmBehavior.Replace, select = true}
    }
  ),
  sources = {{name = "nvim_lsp"}, {name = "luasnip"}, {name = "buffer"}, {name = "path"}}
}

-- code formatting
local formatter = require("formatter")

local prettier = function()
  return {
    exe = "prettier",
    args = {"--stdin-filepath", vim.api.nvim_buf_get_name(0)},
    stdin = true
  }
end

formatter.setup {
  filetype = {
    html = {prettier},
    javascript = {prettier},
    javascriptreact = {prettier},
    json = {prettier},
    markdown = {prettier},
    scss = {prettier},
    typescript = {prettier},
    typescriptreact = {prettier},
    vue = {prettier},
    yaml = {prettier},
    xml = {
      function()
        return {
          exe = "xmllint",
          args = {"--format", vim.api.nvim_buf_get_name(0)},
          stdin = true
        }
      end
    },
    elixir = {
      function()
        return {
          exe = "mix format",
          args = {"-"},
          stdin = true
        }
      end
    },
    go = {
      function()
        return {
          exe = "gofmt",
          args = {vim.api.nvim_buf_get_name(0)},
          stdin = true
        }
      end
    },
    lua = {
      function()
        return {
          exe = "luafmt",
          args = {"--indent-count", 2, "--stdin"},
          stdin = true
        }
      end
    },
    python = {
      function()
        return {
          exe = "black",
          args = {"-"},
          stdin = true
        }
      end
    }
  }
}

vim.keymap.set("n", "<leader>f", ":FormatWrite<cr>") -- format files
