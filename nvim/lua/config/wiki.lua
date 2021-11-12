vim.g.vimwiki_list = {
  {
    path = "~/dev/notes",
    path_html = "~/dev/notes/html",
    syntax = "markdown",
    ext = ".md"
  }
}

vim.g.glow_border = "rounded"
vimp.nnoremap("<leader>wp", ":Glow<cr>")
