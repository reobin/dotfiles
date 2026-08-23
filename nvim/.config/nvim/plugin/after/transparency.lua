-- Make highlight groups transparent while preserving their other attributes
local function make_transparent(name)
  local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = name, link = false })
  if ok and next(hl) then
    hl.bg = nil
    hl.ctermbg = nil
    vim.api.nvim_set_hl(0, name, hl)
  end
end

local groups = {
  "Normal",
  "NormalNC",
  "NormalFloat",
  "FloatBorder",
  "Pmenu",
  "Terminal",
  "EndOfBuffer",
  "FoldColumn",
  "Folded",
  "SignColumn",
  "LineNr",
  "CursorLineNr",
  "DiagnosticSignInfo",
  "DiagnosticSignWarn",
  "DiagnosticSignHint",
  "DiagnosticSignError",
  "WhichKeyFloat",
}

local function apply()
  for _, name in ipairs(groups) do
    make_transparent(name)
  end
end

-- Any colorscheme load re-populates these backgrounds, and `<leader>uC` applies
-- one per item it previews and again on close, so applying once is not enough.
vim.api.nvim_create_autocmd("ColorScheme", {
  group = vim.api.nvim_create_augroup("transparency", { clear = true }),
  callback = apply,
})

apply()
