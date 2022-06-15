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

vim.cmd [[ colorscheme murphy ]]

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

-- #finder --
vimp.nnoremap("<leader>p", ":Telescope find_files<cr>") -- find file
vimp.nnoremap("<leader>s", ":Telescope live_grep<cr>") -- find text in files
vimp.nnoremap("<leader>e", ":Neotree focus toggle reveal=true position=float<cr>")
vimp.nnoremap("<leader>b", ":Neotree focus toggle position=float source=buffers<cr>")
vimp.nnoremap("<leader>h", ":Neotree focus toggle position=float source=git_status<cr>")

-- #git --
vimp.nnoremap("<leader>gs", ":Git<cr>")
vimp.nnoremap("<leader>gd", ":Gitsigns diffthis<cr>")
vimp.nnoremap("<leader>gj", ":Gitsigns next_hunk<cr>")
vimp.nnoremap("<leader>gk", ":Gitsigns prev_hunk<cr>")
vimp.nnoremap("<leader>gp", ":Gitsigns preview_hunk<cr>")
vimp.nnoremap("<leader>gr", ":Gitsigns reset_hunk<cr>")
vimp.nnoremap("<leader>ga", ":Gitsigns stage_hunk<cr>")
vimp.nnoremap("<leader>gu", ":Gitsigns undo_stage_hunk<cr>")

vimp.nnoremap("<leader>f", ":FormatWrite<cr>") -- format file

vimp.nnoremap("<leader><leader>r", ":Telescope lsp_references<cr>") -- go to reference
vimp.nnoremap("<leader><leader>d", ":Telescope lsp_definitions<cr>") -- go to definition
vimp.nnoremap("<leader><leader>h", ":lua vim.lsp.buf.hover()<cr>") -- hover word
vimp.nnoremap("<leader><leader>e", ":lua vim.lsp.diagnostic.show_line_diagnostics()<cr>") -- display word errors

-- #config files --

require("config.treesitter")
require("config.lsp")
require("config.statusline")
require("config.formatter")
