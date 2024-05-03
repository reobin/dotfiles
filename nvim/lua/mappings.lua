local map = vim.keymap.set

map("n", "<leader>l", "<C-^>") -- open last buffer
map("n", "<leader>/", ":noh<cr>") -- remove search highlight

map("n", "<leader>p", ":Telescope find_files<cr>")
map("n", "<leader>s", ":Telescope live_grep<cr>")
map("n", "<space>e", ":Explore<cr>")

map("n", "<leader>gs", ":Git<cr>")
map("n", "<leader>gb", ":Git blame<cr>")

map("n", "<leader>e", ":Neotree focus toggle position=float reveal=true<cr>")
