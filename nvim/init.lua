require("plugins")

-- #options --

-- tabs
vim.o.autoindent = true -- Copy indent from current line
vim.o.tabstop = 2 -- Number of spaces that a <Tab> counts for
vim.o.shiftwidth = vim.o.tabstop -- The amount of indent added
vim.o.expandtab = true -- Insert spaces with the <Tab> key

-- other
vim.o.relativenumber = true -- Use relative number on gutter
vim.o.hidden = true -- Do not unload buffers when switching

-- map leader: <Space>
vim.g.mapleader = " "

-- colorscheme
vim.cmd("colorscheme moonfly")

-- #general_key_mappings --

local vimp = require("vimp")

-- J = keep the cursor in place while joining lines
vimp.nnoremap("J", "mzJ`z")

-- ee = :Explore
vimp.nnoremap("<leader>ee", ":Explore<cr>")

-- r = reload vimrc
vimp.nnoremap(
  "<leader>r",
  function()
    -- remove all previously added vimpeccable maps
    vimp.unmap_all()

    -- make sure all open buffers are saved
    vim.cmd("silent wa")

    -- execute our vimrc lua file again to add back our maps
    dofile(vim.fn.stdpath("config") .. "/init.lua")

    print("init.lua reloaded")
  end
)

-- l = open last buffer

vimp.nnoremap("<leader>l", "<C-^>")

-- c = copy to clipboard
vimp.xnoremap("<leader>c", '"*y')

-- / = remove search highlight
vimp.nnoremap("<leader>/", ":noh<cr>")

-- #telescope --

vimp.nnoremap("<leader>p", ":Telescope find_files<cr>")
vimp.nnoremap("<leader>s", ":Telescope live_grep<cr>")
vimp.nnoremap("<leader>b", ":Telescope buffers<cr>")

local actions = require("telescope.actions")
local telescope = require("telescope")

telescope.setup {
  defaults = {
    mappings = {
      i = {["<ESC>"] = actions.close}
    }
  }
}

-- #treesitter --

treesitter_languages = {
  "go",
  "javascript",
  "lua",
  "tsx",
  "typescript"
}

polyglot_languages = {
  "elixir"
}

local treesitter = require("nvim-treesitter.configs")

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true,
    disable = polyglot_languages
  }
}

vim.g.polyglot_disabled = treesitter_languages

vimp.nnoremap("<leader><leader>r", ":Telescope lsp_references<cr>")
vimp.nnoremap("<leader><leader>d", ":Telescope lsp_definitions<cr>")

-- #lsp --

vimp.nnoremap("<leader><leader>h", ":lua vim.lsp.buf.hover()<cr>")
vimp.nnoremap("<leader><leader>e", ":lua vim.lsp.diagnostic.show_line_diagnostics()<cr>")

local lsp = require("lspconfig")

-- set up language servers
lsp.tsserver.setup {}

-- #completion

vim.o.completeopt = "menuone,noselect"

local cmp = require("cmp")

cmp.setup {
  sources = {
    {name = "nvim_lsp"},
    {name = "buffer"}
  },
  mapping = {
    ["<cr>"] = cmp.mapping.confirm({select = true})
  }
}

-- #formatting

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
    javascript = {prettier},
    javascriptreact = {prettier},
    typescript = {prettier},
    typescriptreact = {prettier},
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
    }
  }
}

vimp.nnoremap("<leader>f", ":FormatWrite<cr>")

-- #fugitive --

vimp.nnoremap("<leader>gg", ":G<cr>")
