local groups = { "Normal", "NormalNC", "EndOfBuffer", "SignColumn", "LineNr", "FoldColumn", "StatusLine", "StatusLineNC" }

local function clear()
  for _, group in ipairs(groups) do
    vim.cmd.highlight(group, "guibg=NONE", "ctermbg=NONE")
  end
end

clear()
vim.api.nvim_create_autocmd("ColorScheme", { callback = clear })

-- The mod pastes the clipboard as soon as nvim exits, so it's filled on write.
vim.api.nvim_create_autocmd("BufWritePost", {
  callback = function(ev)
    local text = table.concat(vim.api.nvim_buf_get_lines(ev.buf, 0, -1, false), "\n"):gsub("%s+$", "")
    if text ~= "" then
      vim.fn.system({ "pbcopy" }, text)
    end
  end,
})
