local M = {}

local AGENTS = {
  claude = "Claude Code",
  codex = "Codex",
  opencode = "opencode",
  pi = "pi",
}

local function notify(message, level)
  vim.notify(message, level or vim.log.levels.INFO, { title = "Agent" })
end

local function run(args)
  local output = vim.fn.system(args)
  if vim.v.shell_error ~= 0 then
    return nil, output
  end

  return output, nil
end

local function herdr_json(args)
  local full_args = vim.list_extend({ "herdr" }, args)
  local output, err = run(full_args)
  if not output then
    return nil, err
  end

  local ok, decoded = pcall(vim.json.decode, output)
  if not ok then
    return nil, "invalid Herdr JSON: " .. output
  end

  return decoded, nil
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

local function path_for_agent(path, target)
  local target_cwd = target and (target.foreground_cwd or target.cwd)

  return relative_to(path, target_cwd) or relative_to(path, vim.fn.getcwd()) or path
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

local function build_prompt(comment, selection, target)
  local pieces = {}

  if comment and comment ~= "" then
    table.insert(pieces, comment)
    table.insert(pieces, "")
  end

  if selection.path ~= "" then
    local display_path = path_for_agent(selection.path, target)
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

local function agent_list_label()
  local names = {}
  for _, name in pairs(AGENTS) do
    table.insert(names, name)
  end

  table.sort(names)
  return table.concat(names, ", ")
end

local function copy_to_clipboard(prompt)
  vim.fn.setreg("+", prompt)
  notify(("No %s pane in this Herdr tab. Copied prompt to clipboard."):format(agent_list_label()))
end

local function copy_ambiguous_to_clipboard(prompt)
  vim.fn.setreg("+", prompt)
  notify(("Multiple %s panes in this Herdr tab. Copied prompt to clipboard."):format(agent_list_label()), vim.log.levels.WARN)
end

local function same_tab_agent_panes()
  local current, current_err = herdr_json({ "pane", "current", "--current" })
  if not current then
    return nil, current_err
  end

  local tab_id = current.result and current.result.pane and current.result.pane.tab_id
  if not tab_id then
    return nil, "Herdr did not report the current tab"
  end

  local list, list_err = herdr_json({ "pane", "list" })
  if not list then
    return nil, list_err
  end

  local panes = {}
  for _, pane in ipairs((list.result and list.result.panes) or {}) do
    if pane.tab_id == tab_id and AGENTS[pane.agent] then
      table.insert(panes, pane)
    end
  end

  return panes, nil
end

local function pane_agent_name(pane)
  return AGENTS[pane.agent] or "agent"
end

local function send_to_pane(pane, prompt, submit)
  local _, text_err = run({ "herdr", "pane", "send-text", pane.pane_id, prompt })
  if text_err then
    vim.fn.setreg("+", prompt)
    notify(("Failed to send to %s. Copied prompt to clipboard."):format(pane_agent_name(pane)), vim.log.levels.WARN)
    return
  end

  if submit then
    vim.defer_fn(function()
      local _, key_err = run({ "herdr", "pane", "send-keys", pane.pane_id, "enter" })
      if key_err then
        notify(("Sent prompt to %s, but failed to press Enter."):format(pane_agent_name(pane)), vim.log.levels.WARN)
      end
    end, 150)
  end

  notify(
    submit and ("Sent selection comment to %s."):format(pane_agent_name(pane))
      or ("Drafted selection comment in %s."):format(pane_agent_name(pane))
  )
end

function M.send_visual_selection(opts)
  opts = opts or {}

  local selection = visual_selection()
  if not selection then
    notify("No visual selection found.", vim.log.levels.WARN)
    return
  end

  vim.ui.input({ prompt = "Agent comment: " }, function(comment)
    if comment == nil then
      return
    end

    local panes, panes_err = same_tab_agent_panes()
    if not panes then
      vim.fn.setreg("+", build_prompt(comment, selection))
      notify(
        ("Failed to find %s pane: %s. Copied prompt to clipboard."):format(agent_list_label(), panes_err),
        vim.log.levels.WARN
      )
      return
    end

    if #panes == 0 then
      copy_to_clipboard(build_prompt(comment, selection))
      return
    end

    if #panes > 1 then
      copy_ambiguous_to_clipboard(build_prompt(comment, selection))
      return
    end

    local prompt = build_prompt(comment, selection, panes[1])
    send_to_pane(panes[1], prompt, opts.submit ~= false)
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
