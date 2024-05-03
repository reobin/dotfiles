vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.o.termguicolors = true

-- bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  {
    "sainnhe/sonokai",
    lazy = false, -- make sure we load this during startup if it is your main colorscheme
    priority = 1000, -- make sure to load this before all the other start plugins
    config = function()
      vim.cmd.colorscheme 'sonokai'
    end,
  },
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    }
  },
  "tpope/vim-fugitive",
  "github/copilot.vim",
  { "nvim-telescope/telescope.nvim", tag = "0.1.6", dependencies = { "nvim-lua/plenary.nvim" }},
})

-- telescope
local telescope = require("telescope")
local telescope_actions = require("telescope.actions")
telescope.setup { defaults = { mappings = { i = {["<ESC>"] = telescope_actions.close} } } }

local telescope_builtin = require('telescope.builtin')
vim.keymap.set('n', '<leader>p', telescope_builtin.find_files)
vim.keymap.set('n', '<leader>s', telescope_builtin.live_grep)

vim.keymap.set("n", "<space>e", ":Explore<cr>")

-- use 2 space indentation
vim.o.autoindent = true
vim.o.tabstop = 2
vim.o.shiftwidth = vim.o.tabstop
vim.o.expandtab = true

-- display current line and relative sibling line numbers
vim.o.number = true
vim.o.relativenumber = true

vim.keymap.set("n", "<leader>l", "<C-^>") -- open last buffer
vim.keymap.set("x", "<leader>c", '"*y') -- copy visual selection to clipboard
vim.keymap.set("n", "<leader>/", ":noh<cr>") -- remove search highlight

vim.keymap.set("n", "<leader>gs", ":Git<cr>")
vim.keymap.set("n", "<leader>gb", ":Git blame<cr>")

-- neotree
vim.keymap.set("n", "<leader>e", ":Neotree focus toggle position=float reveal=true<cr>")
