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
        vim.keymap.set("n", "<leader>e", function()
          vim.lsp.buf.code_action({
            context = { only = { "source.fixAll.eslint" } },
            apply = true,
          })
        end, { buffer = ev.buf, desc = "ESLint: Fix all (code action)" })
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
        properties = { "documentation", "detail", "additionalTextEdits" },
      },
    }

    vim.lsp.config("lua_ls", {
      capabilities = capabilities,
      settings = { Lua = { diagnostics = { globals = { "vim" } } } },
    })

    vim.lsp.config("elixirls", {
      cmd = { "elixir-ls" },
      capabilities = capabilities,
    })

    local function make_root(markers)
      return function(bufnr, on_dir)
        local root = vim.fs.root(bufnr, markers)
        on_dir(root or vim.uv.cwd())
      end
    end

    for _, name in ipairs({ "eslint", "gopls", "cssls" }) do
      vim.lsp.config(name, {
        capabilities = capabilities,
        root_dir = make_root({ ".git" }),
      })
    end

    vim.lsp.config("ts_ls", {
      capabilities = capabilities,
      root_dir = make_root({ ".git" }),
      init_options = {
        preferences = {
          importModuleSpecifierPreference = "non-relative",
        },
      },
    })

    vim.lsp.enable({ "lua_ls", "elixirls", "eslint", "gopls", "cssls", "ts_ls" })
  end,
}
