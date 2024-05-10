vim.keymap.set("n", "<leader>l", "<C-^>") -- open last buffer
vim.keymap.set("n", "<leader>/", ":noh<cr>") -- remove search highlight
vim.keymap.set("v", "<leader>y", '"+y') -- copy to clipboard
vim.keymap.set("n", "<leader>e", vim.cmd.Ex) -- netrw

vim.keymap.set("n", "J", "mzJ`z") -- join line and keep cursor position
vim.keymap.set("n", "<C-d>", "<C-d>zz") -- move half page down and center
vim.keymap.set("n", "<C-u>", "<C-u>zz") -- move half page up and center
vim.keymap.set("n", "n", "nzzzv") -- move to next search result and center
vim.keymap.set("n", "N", "Nzzzv") -- move to previous search result and center

vim.keymap.set({ "n", "v" }, "<leader>w", "gw") -- toggle wrap
