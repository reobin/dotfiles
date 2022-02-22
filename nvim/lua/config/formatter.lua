local vimp = require("vimp")
local formatter = require("formatter")

local prettier = function()
  return {
    exe = "prettier",
    args = {"--stdin-filepath", vim.api.nvim_buf_get_name(0)},
    stdin = true
  }
end

formatter.setup {
  filetype = {
    html = {prettier},
    javascript = {prettier},
    javascriptreact = {prettier},
    json = {prettier},
    markdown = {prettier},
    scss = {prettier},
    typescript = {prettier},
    typescriptreact = {prettier},
    vue = {prettier},
    elixir = {
      function()
        return {
          exe = "mix format",
          args = {"-"},
          stdin = true
        }
      end
    },
    go = {
      function()
        return {
          exe = "gofmt",
          args = {vim.api.nvim_buf_get_name(0)},
          stdin = true
        }
      end
    },
    lua = {
      function()
        return {
          exe = "luafmt",
          args = {"--indent-count", 2, "--stdin"},
          stdin = true
        }
      end
    },
    python = {
      function()
        return {
          exe = "black",
          args = {"-"},
          stdin = true
        }
      end
    }
  }
}
