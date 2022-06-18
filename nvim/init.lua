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

    -- file finders
    use {
      "nvim-neo-tree/neo-tree.nvim",
      branch = "v2.x",
      requires = {"nvim-lua/plenary.nvim", "kyazdani42/nvim-web-devicons", "MunifTanjim/nui.nvim"}
    }
    use {"nvim-telescope/telescope.nvim", requires = {"nvim-lua/plenary.nvim"}}
    use {"nvim-telescope/telescope-fzf-native.nvim", run = "make"}
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
vim.cmd [[colorscheme murphy]]

-- configure statusbar
require("lualine").setup {
  options = {
    icons_enabled = false,
    theme = "auto",
    component_separators = "|",
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

-- neo-tree
vim.cmd([[ let g:neo_tree_remove_legacy_commands = 1 ]])
vim.fn.sign_define("DiagnosticSignError", {text = " ", texthl = "DiagnosticSignError"})
vim.fn.sign_define("DiagnosticSignWarn", {text = " ", texthl = "DiagnosticSignWarn"})
vim.fn.sign_define("DiagnosticSignInfo", {text = " ", texthl = "DiagnosticSignInfo"})
vim.fn.sign_define("DiagnosticSignHint", {text = "", texthl = "DiagnosticSignHint"})

require("neo-tree").setup({popup_border_style = "single"})

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
local on_attach = function(_, bufnr)
  local opts = {buffer = bufnr}
  vim.keymap.set("n", "gD", vim.lsp.buf.declaration, opts)
  vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
  vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)
  vim.keymap.set("n", "gi", vim.lsp.buf.implementation, opts)
  vim.keymap.set("n", "<C-k>", vim.lsp.buf.signature_help, opts)
  vim.keymap.set("n", "<leader>wa", vim.lsp.buf.add_workspace_folder, opts)
  vim.keymap.set("n", "<leader>wr", vim.lsp.buf.remove_workspace_folder, opts)
  vim.keymap.set(
    "n",
    "<leader>wl",
    function()
      vim.inspect(vim.lsp.buf.list_workspace_folders())
    end,
    opts
  )
  vim.keymap.set("n", "<leader>D", vim.lsp.buf.type_definition, opts)
  vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, opts)
  vim.keymap.set("n", "gr", vim.lsp.buf.references, opts)
  vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, opts)
  vim.keymap.set("n", "<leader>so", require("telescope.builtin").lsp_document_symbols, opts)
end

-- nvim-cmp supports additional completion capabilities
local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities = require("cmp_nvim_lsp").update_capabilities(capabilities)

-- Enable the following language servers
local servers = {"tsserver", "gopls", "elixirls"}
for _, lsp in ipairs(servers) do
  lspconfig[lsp].setup {
    on_attach = on_attach,
    capabilities = capabilities
  }
end

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
