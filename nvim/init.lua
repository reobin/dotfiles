require("config.plugins")

local home = os.getenv("HOME")
local vimp = require("vimp")
local helpers = require("config.helpers")

vim.o.autoindent = true -- Copy indent from current line
vim.o.tabstop = 2 -- Number of spaces that a <Tab> counts for
vim.o.shiftwidth = vim.o.tabstop -- The amount of indent added
vim.o.expandtab = true -- Insert spaces with the <Tab> key

vim.o.relativenumber = true -- Use relative number on gutter
vim.o.hidden = true -- Do not unload buffers when switching
vim.o.signcolumn = "yes" -- Always show sign column
vim.o.cursorline = true -- Highlight current line
vim.o.termguicolors = true -- use GUI colors

vim.cmd [[ colorscheme kanagawa ]]

vim.o.completeopt = "menuone" -- show menu even if only one item is present
vim.o.completeopt = vim.o.completeopt .. ",noselect" -- do not automatically select an item in the menu

vim.g.mapleader = " " -- map leader: <space>

vim.g.do_filetype_lua = 1 -- enable filetype.lua
vim.g.did_load_filetypes = 0 -- disable filetype.vim

vimp.nnoremap("<leader>r", helpers.reloadNeovimConfig)
vimp.nnoremap("J", "mzJ`z") -- keep the cursor in place while joining lines
vimp.nnoremap("<leader>l", "<C-^>") -- open last buffer
vimp.xnoremap("<leader>c", '"*y') -- copy visual selection to clipboard
vimp.nnoremap("<leader>/", ":noh<cr>") -- remove search highlight

-- vimp.nnoremap("<leader>gg", ":G<cr>") -- toggle open git fugitive

vimp.nnoremap("<leader>e", ":Neotree focus toggle position=float<cr>")
vimp.nnoremap("<leader>b", ":Neotree focus toggle position=float source=buffers<cr>")
vimp.nnoremap("<leader>g", ":Neotree focus toggle position=float source=git_status<cr>")

-- vimp.nnoremap("<leader>gb", ":Gitsigns blame_line<cr>") -- git blame

vimp.nnoremap("<leader>a", ":lua require('harpoon.mark').add_file()<cr>") -- Add file to buffers
vimp.nnoremap("<leader>h", ":lua require('harpoon.ui').toggle_quick_menu()<cr>") -- Open buffers UI

vimp.nnoremap("<leader>f", ":FormatWrite<cr>") -- format file

vimp.nnoremap("<leader>p", ":Telescope find_files<cr>") -- find file
vimp.nnoremap("<leader>s", ":Telescope live_grep<cr>") -- find text in files

vimp.nnoremap("<leader><leader>r", ":Telescope lsp_references<cr>") -- go to reference
vimp.nnoremap("<leader><leader>d", ":Telescope lsp_definitions<cr>") -- go to definition
vimp.nnoremap("<leader><leader>h", ":lua vim.lsp.buf.hover()<cr>") -- hover word
vimp.nnoremap("<leader><leader>e", ":lua vim.lsp.diagnostic.show_line_diagnostics()<cr>") -- display word errors

-- #config files --

require("config.treesitter")
require("config.lsp")
require("config.statusline")
require("config.formatter")
