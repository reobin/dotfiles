-- Neovim's default colorscheme in GUI colors. `background` has to track the
-- system explicitly so the light and dark variants follow macOS.
local function sync_background()
  local out = vim.fn.system("defaults read -g AppleInterfaceStyle 2>/dev/null")
  local background = out:match("Dark") and "dark" or "light"
  if vim.o.background ~= background then
    vim.o.background = background
  end
end

sync_background()
vim.fn.timer_start(5000, function()
  sync_background()
end, { ["repeat"] = -1 })

return {
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "default",
    },
  },
}
