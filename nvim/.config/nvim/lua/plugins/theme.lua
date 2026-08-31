local active_theme = "nightfox"
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
    "catppuccin/nvim",
    name = "catppuccin",
    lazy = false,
    priority = 1000,
  },
  {
    "EdenEast/nightfox.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "rose-pine/neovim",
    name = "rose-pine",
    lazy = false,
    priority = 1000,
  },
  {
    "webhooked/kanso.nvim",
    lazy = false,
    priority = 1000,
  },
  {
    "rebelot/kanagawa.nvim",
    lazy = false,
    priority = 1000,
    opts = function()
      local ground = vim.g.kanagawa_ground

      if type(ground) ~= "string" then
        return {}
      end

      -- bg_m1 through bg_m3 and the gutter are all steps below Wave's own
      -- #1F1F28, so they land above a ground this dark unless they come with it.
      return {
        colors = {
          theme = {
            wave = {
              ui = {
                bg = ground,
                bg_m1 = ground,
                bg_m2 = ground,
                bg_m3 = ground,
                bg_gutter = ground,
              },
            },
          },
        },
      }
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = active_theme,
    },
  },
}
