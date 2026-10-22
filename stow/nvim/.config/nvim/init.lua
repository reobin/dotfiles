-- ~/.config/nvim/init.lua  (managed by ~/dotfiles, nvim module)
-- Minimal starter config. Extend freely, then re-run `~/dotfiles/install.sh nvim`.
-- Plugins use built-in vim.pack (nvim 0.12+, no manager needed).
-- After first write / adding a plugin, run `:PackUpdate` in nvim.

vim.g.mapleader = ' '

local opt = vim.opt
opt.number = true
opt.relativenumber = true
opt.mouse = 'a'
opt.ignorecase = true
opt.smartcase = true
opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.termguicolors = true
opt.clipboard = 'unnamedplus'
opt.undofile = true

vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<cr>', { desc = 'clear search highlight' })

-- --- plugins ---
vim.pack.add({
  'https://github.com/stevearc/oil.nvim',
  'https://github.com/echasnovski/mini.icons',
  'https://github.com/echasnovski/mini.pick',
  'https://github.com/nvim-treesitter/nvim-treesitter',
  'https://github.com/tpope/vim-sleuth',
}, { confirm = false })

-- icons (oil + pick dependency)
pcall(function() require('mini.icons').setup() end)

-- oil: file manager, replaces netrw :Ex
pcall(function()
  require('oil').setup({
    default_file_explorer = true,
    view_options = { show_hidden = true },
  })
end)
vim.keymap.set('n', '<leader>e', '<cmd>Oil<cr>', { desc = 'open oil file explorer' })

-- pick: fuzzy finder (files / grep / buffers)
pcall(function() require('mini.pick').setup() end)
vim.keymap.set('n', '<leader>f', function() require('mini.pick').builtin.files() end, { desc = 'find files' })
vim.keymap.set('n', '<leader>g', function() require('mini.pick').builtin.grep_live() end, { desc = 'live grep' })
vim.keymap.set('n', '<leader>b', function() require('mini.pick').builtin.buffers() end, { desc = 'find buffers' })
vim.keymap.set('n', '<leader>h', function() require('mini.pick').builtin.help() end, { desc = 'find help' })

-- treesitter: better syntax highlighting (best-effort, needs :TSUpdate + parsers)
pcall(function()
  require('nvim-treesitter').setup({
    auto_install = true,
    highlight = { enable = true },
  })
end)
