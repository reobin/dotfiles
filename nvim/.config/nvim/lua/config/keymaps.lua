vim.keymap.set("n", "J", "mzJ`z") -- join lines without moving cursor
vim.keymap.set("n", "<C-d>", "<C-d>zz") -- center screen after half-page down
vim.keymap.set("n", "<C-u>", "<C-u>zz") -- center screen after half-page up
vim.keymap.set("n", "n", "nzz") -- center screen after search next
vim.keymap.set("n", "N", "Nzz") -- center screen after search previous

vim.keymap.del("n", "<A-j>")
vim.keymap.del("n", "<A-k>")
vim.keymap.del("i", "<A-j>")
vim.keymap.del("i", "<A-k>")

vim.keymap.del("n", "<leader>e")
vim.keymap.del("n", "<leader>E")
