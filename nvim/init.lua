require("config.plugins")

local home = os.getenv("HOME")
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

vim.keymap.set("n", "<leader>r", helpers.reloadNeovimConfig)
vim.keymap.set("n", "J", "mzJ`z") -- keep the cursor in place while joining lines
vim.keymap.set("n", "<leader>l", "<C-^>") -- open last buffer
vim.keymap.set("x", "<leader>c", '"*y') -- copy visual selection to clipboard
vim.keymap.set("n", "<leader>/", ":noh<cr>") -- remove search highlight

-- #finder --
vim.keymap.set("n", "<leader>p", ":Telescope find_files<cr>") -- find file
vim.keymap.set("n", "<leader>s", ":Telescope live_grep<cr>") -- find text in files
vim.keymap.set("n", "<leader>e", ":Neotree focus toggle reveal=true position=float<cr>")
vim.keymap.set("n", "<leader>b", ":Neotree focus toggle position=float source=buffers<cr>")
vim.keymap.set("n", "<leader>h", ":Neotree focus toggle position=float source=git_status<cr>")

-- #git --
vim.keymap.set("n", "<leader>gs", ":Git<cr>")
vim.keymap.set("n", "<leader>gd", ":Gitsigns diffthis<cr>")
vim.keymap.set("n", "<leader>gj", ":Gitsigns next_hunk<cr>")
vim.keymap.set("n", "<leader>gk", ":Gitsigns prev_hunk<cr>")
vim.keymap.set("n", "<leader>gp", ":Gitsigns preview_hunk<cr>")
vim.keymap.set("n", "<leader>gr", ":Gitsigns reset_hunk<cr>")
vim.keymap.set("n", "<leader>ga", ":Gitsigns stage_hunk<cr>")
vim.keymap.set("n", "<leader>gu", ":Gitsigns undo_stage_hunk<cr>")

vim.keymap.set("n", "<leader>f", ":FormatWrite<cr>") -- format files

vim.keymap.set("n", "<leader><leader>r", ":Telescope lsp_references<cr>") -- go to reference
vim.keymap.set("n", "<leader><leader>d", ":Telescope lsp_definitions<cr>") -- go to definition
vim.keymap.set("n", "<leader><leader>h", ":lua vim.lsp.buf.hover()<cr>") -- hover word
vim.keymap.set("n", "<leader><leader>e", ":lua vim.lsp.diagnostic.show_line_diagnostics()<cr>") -- display word errors

-- #config files --

require("config.treesitter")
require("config.lsp")
require("config.statusline")
require("config.formatter")
