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
      },
      ["<Tab>"] = cmp.mapping(
        function(fallback)
          if cmp.visible() then
            cmp.select_next_item()
          elseif luasnip.expand_or_jumpable() then
            luasnip.expand_or_jump()
          else
            fallback()
          end
        end,
        {"i", "s"}
      ),
      ["<S-Tab>"] = cmp.mapping(
        function(fallback)
          if cmp.visible() then
            cmp.select_prev_item()
          elseif luasnip.jumpable(-1) then
            luasnip.jump(-1)
          else
            fallback()
          end
        end,
        {"i", "s"}
      )
    }
  ),
  sources = {
    {name = "nvim_lsp"},
    {name = "luasnip"},
    {name = "buffer"},
    {name = "path"}
  }
}
