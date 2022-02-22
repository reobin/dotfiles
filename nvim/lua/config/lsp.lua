local vimp = require("vimp")

-- #telescope --

local actions = require("telescope.actions")
local telescope = require("telescope")

telescope.setup {
  defaults = {
    mappings = {
      i = {["<ESC>"] = actions.close}
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

-- #lsp --

local lsp = require("lspconfig")

lsp.tsserver.setup {}
lsp.gopls.setup {}

-- #nvim-cmp --

local cmp = require("cmp")

cmp.setup {
  snippet = {
    expand = function(args)
      require "luasnip".lsp_expand(args.body)
    end
  },
  sources = {
    {name = "nvim_lsp"},
    {name = "luasnip"},
    {name = "buffer"}
  },
  mapping = {
    ["<cr>"] = cmp.mapping.confirm({select = true})
  }
}