require('plugins')


-- Options --

-- Tabs
vim.o.autoindent = true             -- Copy indent from current line
vim.o.tabstop = 2                   -- Number of spaces that a <Tab> counts for
vim.o.shiftwidth = vim.o.tabstop    -- The amount of indent added
vim.o.expandtab = true              -- Insert spaces with the <Tab> key

-- Other options
vim.o.relativenumber = true         -- Use relative number on gutter
vim.o.hidden = true                 -- Do not unload buffers when switching

-- Map leader: <Space>
vim.g.mapleader = ' '

-- Color scheme
vim.cmd('colorscheme moonfly')


-- General key mappings --

local vimp = require('vimp')

-- J = Keep the cursor in place while joining lines
vimp.nnoremap('J', 'mzJ`z')

-- ee = Explore
vimp.nnoremap('<leader>ee', ':Explore<cr>')

-- r = reload vimrc
vimp.nnoremap('<leader>r',
  function()
    -- Remove all previously added vimpeccable maps
    vimp.unmap_all()

    -- Make sure all open buffers are saved
    vim.cmd('silent wa')

    -- Execute our vimrc lua file again to add back our maps
    dofile(vim.fn.stdpath('config') ..  '/init.lua')

    print('init.lua reloaded')
  end
)


-- Telescope --

vimp.nnoremap('<leader>p', ':Telescope find_files<cr>')
vimp.nnoremap('<leader>s', ':Telescope live_grep<cr>')
vimp.nnoremap('<leader>b', ':Telescope buffers<cr>')

local actions = require('telescope.actions')
local telescope = require('telescope')

telescope.setup {
  defaults = {
    mappings = {
      i = { ['<ESC>'] = actions.close }
    }
  }
}

-- Treesitter --

treesitter_languages = {
  'go',
  'javascript',
  'lua',
  'tsx',
  'typescript',
}

polyglot_languages = {
  'elixir',
}

local treesitter = require('nvim-treesitter.configs')

treesitter.setup {
  ensure_installed = treesitter_languages,
  highlight = {
    enable = true,
    disable = polyglot_languages,
  },
}

vim.g.polyglot_disabled = treesitter_languages

vimp.nnoremap('<leader>lr', ':Telescope lsp_references<cr>')
vimp.nnoremap('<leader>ld', ':Telescope lsp_definitions<cr>')


-- LSP --

local nvim_lsp = require('lspconfig')

vimp.nnoremap('<leader>lh', ':lua vim.lsp.buf.hover()<cr>')
vimp.nnoremap('<leader>le', ':lua vim.lsp.diagnostic.show_line_diagnostics()<cr>')

-- typescript, javascript
nvim_lsp.tsserver.setup {}


-- Completion

vim.o.completeopt = 'menuone,noselect'

local cmp = require('cmp')

cmp.setup {
  sources = {
    { name = 'nvim_lsp' },
    { name = 'buffer' },
  },
  mapping = {
    ['<cr>'] = cmp.mapping.confirm({ select = true }),
  },
}


-- Formatting

local formatter = require('formatter')

formatter.setup {
  filetype = {
    javascript = {
      function()
        return {
          exe = 'prettier',
          stdin = true,
        }
      end
    },
    typescriptreact = {
      function()
        return {
          exe = 'prettier',
          args = {
            "--stdin-filepath",
            vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)),
          },
          stdin = true,
        }
      end
    },
  },
}

vimp.nnoremap('<leader>f', ':FormatWrite<cr>')
