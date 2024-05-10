return {
  "stevearc/conform.nvim",
  event = { "BufWritePre" },
  cmd = { "ConformInfo" },
  opts = {
    formatters_by_ft = {
      lua = { "stylua" },
      javascript = { "prettier" },
      typescript = { "prettier" },
      javascriptreact = { "prettier" },
      typescriptreact = { "prettier" },
      css = { "prettier" },
      scss = { "prettier" },
      json = { "prettier" },
    },
  },
  config = function()
    vim.keymap.set("n", "<leader>f", function()
      require("conform").format { async = true, lsp_fallback = true }
    end)
  end,
}
