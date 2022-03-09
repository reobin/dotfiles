vim.g.vimwiki_list = {
  {
    path = "~/dev/notes",
    path_html = "~/dev/notes/html",
    syntax = "markdown",
    ext = ".md"
  }
}

vim.g.glow_border = "rounded"

vimp.nnoremap("<leader>wpp", ":Glow<cr>")

local wiki = {}

function wiki.export()
  local filepath = vim.fn.expand("%:h")
  local shortened = string.match(filepath, "dev/(.*)")

  if (shortened == nil) then
    shortened = filepath
  end

  local exportedfilename = shortened:gsub("/", "__")
  local fullpath = "~/Downloads/" .. exportedfilename .. ".pdf"

  local cmd = "! pandoc % -o " .. fullpath

  vim.cmd(cmd)
end

vimp.nnoremap("<leader>wpd", wiki.export)
