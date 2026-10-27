-- Terminal palette only: no colorscheme plugin, so Ghostty's light/dark palette
-- is the single source of truth. `background` still has to track the system
-- explicitly; the ANSI slots follow on their own.
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
