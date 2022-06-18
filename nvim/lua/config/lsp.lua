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

local cmp = require "cmp"
cmp.setup {
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end
  },
  mapping = cmp.mapping.preset.insert(
    {
      ["<CR>"] = cmp.mapping.confirm {
        behavior = cmp.ConfirmBehavior.Replace,
        select = true
      }
    }
  ),
  sources = {
    {name = "nvim_lsp"},
    {name = "luasnip"},
    {name = "buffer"},
    {name = "path"}
  }
}
