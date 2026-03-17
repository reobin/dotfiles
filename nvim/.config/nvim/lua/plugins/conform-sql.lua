return {
  "stevearc/conform.nvim",
  optional = true,
  opts = function(_, opts)
    opts.formatters = opts.formatters or {}
    opts.formatters_by_ft = opts.formatters_by_ft or {}

    local sql_ft = { "sql", "mysql", "plsql" }

    opts.formatters.sqlfluff = {
      command = "sqlfluff",
      args = { "format", "--dialect=ansi", "-" },
      stdin = true,
      cwd = function()
        return vim.fn.getcwd()
      end,
    }

    for _, ft in ipairs(sql_ft) do
      opts.formatters_by_ft[ft] = opts.formatters_by_ft[ft] or {}
      table.insert(opts.formatters_by_ft[ft], "sqlfluff")
    end
  end,
}
