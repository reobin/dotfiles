local M = {}

local function notify(message, level)
  vim.notify(message, level or vim.log.levels.INFO, { title = "Agent" })
end

local function normalize(path)
  if not path or path == "" then
    return nil
  end

  return (vim.uv or vim.loop).fs_realpath(path) or vim.fn.fnamemodify(path, ":p"):gsub("/$", "")
end

local function relative_to(path, base)
  path = normalize(path)
  base = normalize(base)

  if not path or not base then
    return nil
  end

  if path == base then
    return vim.fn.fnamemodify(path, ":t")
  end

  local prefix = base .. "/"
  if path:sub(1, #prefix) == prefix then
    return path:sub(#prefix + 1)
  end

  return nil
end

local function path_for_agent(path)
  return relative_to(path, vim.fn.getcwd()) or path
end

local function visual_selection()
  local buf = vim.api.nvim_get_current_buf()
  local mode = vim.fn.mode()
  local in_visual_mode = mode == "v" or mode == "V" or mode == "\22"
  local start_pos = in_visual_mode and vim.fn.getpos("v") or vim.fn.getpos("'<")
  local end_pos = in_visual_mode and vim.fn.getcurpos() or vim.fn.getpos("'>")
  local start_line = start_pos[2]
  local end_line = end_pos[2]

  if start_line == 0 or end_line == 0 then
    return nil
  end

  if start_line > end_line then
    start_line, end_line = end_line, start_line
  end

  local lines = vim.api.nvim_buf_get_lines(0, start_line - 1, end_line, false)
  return {
    buf = buf,
    filetype = vim.bo[buf].filetype,
    modified = vim.bo[buf].modified,
    path = vim.api.nvim_buf_get_name(buf),
    start_line = start_line,
    end_line = end_line,
    text = table.concat(lines, "\n"),
  }
end

local function build_prompt(comment, selection)
  local pieces = {}

  if comment and comment ~= "" then
    table.insert(pieces, comment)
    table.insert(pieces, "")
  end

  if selection.path ~= "" then
    local display_path = path_for_agent(selection.path)
    table.insert(pieces, "Context:")
    table.insert(pieces, ("@%s lines %d-%d"):format(display_path, selection.start_line, selection.end_line))
    if selection.modified then
      table.insert(pieces, "")
      table.insert(pieces, "Note: this buffer has unsaved changes, so save it first if the agent should see the current text.")
    end
  else
    table.insert(pieces, "Context from visual selection:")
    table.insert(pieces, ("```%s"):format(selection.filetype))
    table.insert(pieces, selection.text)
    table.insert(pieces, "```")
  end

  return table.concat(pieces, "\n")
end

function M.send_visual_selection()
  local selection = visual_selection()
  if not selection then
    notify("No visual selection found.", vim.log.levels.WARN)
    return
  end

  vim.ui.input({ prompt = "Agent comment: " }, function(comment)
    if comment == nil then
      return
    end

    vim.fn.setreg("+", build_prompt(comment, selection))
    notify("Copied selection comment to clipboard.")
  end)
end

function M.copy_visual_selection()
  local selection = visual_selection()
  if not selection then
    notify("No visual selection found.", vim.log.levels.WARN)
    return
  end

  vim.ui.input({ prompt = "Agent comment: " }, function(comment)
    if comment == nil then
      return
    end

    vim.fn.setreg("+", build_prompt(comment, selection))
    notify("Copied selection comment to clipboard.")
  end)
end

return M
