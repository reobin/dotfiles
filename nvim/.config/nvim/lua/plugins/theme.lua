local active_theme = "olive-crt"
local theme_file = vim.fn.expand("~/.config/tt/active/nvim.lua")
local ok, theme = pcall(dofile, theme_file)

if ok and type(theme) == "table" then
  if type(theme.globals) == "table" then
    for key, value in pairs(theme.globals) do
      vim.g[key] = value
    end
  end

  if type(theme.options) == "table" then
    for key, value in pairs(theme.options) do
      vim.o[key] = value
    end
  end

  if type(theme.colorscheme) == "string" then
    active_theme = theme.colorscheme
  end
end

return {
  {
    "reobin/olive-crt.nvim",
    name = "olive-crt",
    lazy = false,
    priority = 1000,
  },
  {
    "catppuccin/nvim",
    name = "catppuccin",
    lazy = false,
    priority = 1000,
  },
  {
    "junegunn/seoul256.vim",
    lazy = false,
    priority = 1000,
  },
  {
    "EdenEast/nightfox.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "sainnhe/everforest",
    lazy = false,
    priority = 1000,
  },
  {
    "tanvirtin/monokai.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = active_theme,
    },
  },
}
