local map = vim.keymap.set

map("n", "<leader>l", "<C-^>") -- open last buffer
map("n", "<leader>/", ":noh<cr>") -- remove search highlight

map("n", "<leader>p", ":Telescope find_files find_command=rg,--hidden,--ignore,--files<cr>")
map("n", "<leader>s", ":Telescope live_grep<cr>")
map("n", "<leader>b", ":Telescope buffers<cr>")
map("n", "<space>e", ":Explore<cr>")

map("n", "<leader>gs", ":Git<cr>")
map("n", "<leader>gb", ":Git blame<cr>")

map("n", "<leader>e", ":Neotree focus toggle position=float reveal=true<cr>")

map("n", "<leader>f", function()
  require("conform").format { async = true, lsp_fallback = true }
end)
map("n", "<leader>j", ":EslintFixAll<cr>")
