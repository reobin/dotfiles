local M = {}

function M.macro_recording()
  local reg = vim.fn.reg_recording()
  if reg == "" then
    return ""
  end
  return "REC @" .. reg
end

function M.setup_macro_recording_refresh()
  local group = vim.api.nvim_create_augroup("lualine_macro_recording", { clear = true })
  vim.api.nvim_create_autocmd({ "RecordingEnter", "RecordingLeave" }, {
    group = group,
    callback = function()
      local ok, lualine = pcall(require, "lualine")
      if ok then
        lualine.refresh({ place = { "statusline" } })
      end
    end,
  })
end

return M
