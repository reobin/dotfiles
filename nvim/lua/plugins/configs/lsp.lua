return {
  "neovim/nvim-lspconfig",
  event = { "BufReadPre", "BufNewFile" },
  config = function()
    vim.api.nvim_create_autocmd("LspAttach", {
      group = vim.api.nvim_create_augroup("UserLspConfig", {}),
      callback = function(ev)
        local opts = { buffer = ev.buf }
        vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
        vim.keymap.set("n", "<leader>h", vim.lsp.buf.hover, opts)
        vim.keymap.set("n", "<leader>d", function()
          vim.diagnostic.open_float(0, { scope = "line" })
        end, opts)
        vim.keymap.set("n", "<leader>e", ":EslintFixAll<cr>")
      end,
    })

    vim.diagnostic.config({ virtual_text = false })

    local capabilities = vim.lsp.protocol.make_client_capabilities()
    capabilities.textDocument.completion.completionItem = {
      documentationFormat = { "markdown", "plaintext" },
      snippetSupport = true,
      preselectSupport = true,
      insertReplaceSupport = true,
      labelDetailsSupport = true,
      deprecatedSupport = true,
      commitCharactersSupport = true,
      tagSupport = { valueSet = { 1 } },
      resolveSupport = {
        properties = {
          "documentation",
          "detail",
          "additionalTextEdits",
        },
      },
    }

    local lspconfig = require("lspconfig")

    lspconfig.lua_ls.setup({
      capabilities = capabilities,
      settings = { Lua = { diagnostics = { globals = { "vim" } } } },
    })

    lspconfig.elixirls.setup({ cmd = { "elixir-ls" } })

    for _, lsp in ipairs({ "eslint", "gopls", "cssls" }) do
      lspconfig[lsp].setup({
        root_dir = lspconfig.util.root_pattern(".git"),
        capabilities = capabilities,
      })
    end

    lspconfig.ts_ls.setup({
      root_dir = lspconfig.util.root_pattern(".git"),
      capabilities = capabilities,

      on_new_config = function(config)
        config.init_options = {
          preferences = {
            importModuleSpecifierPreference = "non-relative",
          },
        }
      end,
    })
  end,
}
