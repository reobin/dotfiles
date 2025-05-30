vim.g.mapleader = " "

vim.o.termguicolors = true

vim.o.autoindent = true
vim.o.tabstop = 2
vim.o.shiftwidth = vim.o.tabstop
vim.o.expandtab = true

vim.o.laststatus = 3
vim.o.statusline = "%f %y %= %c/%{strlen(getline('.'))} %l/%L"
vim.o.signcolumn = "yes:1"
vim.o.numberwidth = 3
vim.o.statuscolumn = "%l%s"

vim.o.number = true
vim.o.relativenumber = true

vim.o.incsearch = true
vim.o.cursorline = true
