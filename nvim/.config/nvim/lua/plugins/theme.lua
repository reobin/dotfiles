local active_theme = "olive-crt"
local theme_file = vim.fn.expand("~/.config/terminal-theme/active/nvim.lua")
local ok, theme = pcall(dofile, theme_file)

if ok and type(theme) == "table" then
  if type(theme.globals) == "table" then
    for key, value in pairs(theme.globals) do
      vim.g[key] = value
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
    "folke/tokyonight.nvim",
    lazy = false,
    priority = 1000,
    opts = {
      style = "storm",
    },
  },
  {
    "ellisonleao/gruvbox.nvim",
    lazy = false,
    priority = 1000,
    opts = {
      contrast = "hard",
    },
  },
  {
    "projekt0n/github-nvim-theme",
    name = "github-theme",
    lazy = false,
    priority = 1000,
  },
  {
    "miikanissi/modus-themes.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "Mofiqul/dracula.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "navarasu/onedark.nvim",
    lazy = false,
    priority = 1000,
    opts = {
      style = "darker",
    },
  },
  {
    "junegunn/seoul256.vim",
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
