pcall(vim.api.nvim_del_augroup_by_name, "lazyvim_wrap_spell")

pcall(vim.api.nvim_del_augroup_by_name, "lazyvim_last_loc")
vim.api.nvim_create_autocmd("BufReadPost", {
  group = vim.api.nvim_create_augroup("lazyvim_last_loc", { clear = true }),
  callback = function(event)
    local exclude = { "gitcommit", "gitrebase" }
    local buf = event.buf
    if vim.tbl_contains(exclude, vim.bo[buf].filetype) or vim.b[buf].lazyvim_last_loc then
      return
    end
    vim.b[buf].lazyvim_last_loc = true
    local mark = vim.api.nvim_buf_get_mark(buf, '"')
    local lcount = vim.api.nvim_buf_line_count(buf)
    if mark[1] > 0 and mark[1] <= lcount then
      pcall(vim.api.nvim_win_set_cursor, 0, mark)
    end
  end,
})
