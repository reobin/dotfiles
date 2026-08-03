-- LazyVim's lang.sql extra wires sqlfluff in as both linter and formatter.
-- Its style rules are noise on the throwaway queries in dadbod buffers, and its
-- formatter only runs inside a project holding a .sqlfluff or pyproject.toml.
-- sql-formatter is formatting only and needs no such setup.
local sql_ft = { "sql", "mysql", "plsql" }

return {
  {
    "mfussenegger/nvim-lint",
    optional = true,
    opts = function(_, opts)
      opts.linters_by_ft = opts.linters_by_ft or {}
      for _, ft in ipairs(sql_ft) do
        opts.linters_by_ft[ft] = {}
      end
    end,
  },
  {
    "stevearc/conform.nvim",
    optional = true,
    opts = function(_, opts)
      opts.formatters_by_ft = opts.formatters_by_ft or {}
      for _, ft in ipairs(sql_ft) do
        opts.formatters_by_ft[ft] = { "sql_formatter" }
      end
    end,
  },
  {
    "mason-org/mason.nvim",
    optional = true,
    opts = function(_, opts)
      opts.ensure_installed = vim.tbl_filter(function(tool)
        return tool ~= "sqlfluff"
      end, opts.ensure_installed or {})
      table.insert(opts.ensure_installed, "sql-formatter")
    end,
  },
}
