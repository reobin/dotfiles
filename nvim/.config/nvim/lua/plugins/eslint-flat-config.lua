-- nvim-lspconfig force-enables `experimental.useFlatConfig` in `before_init`
-- whenever it finds an eslint.config.* in the project root. That flag makes
-- vscode-eslint import FlatESLint from `eslint/use-at-your-own-risk`, which
-- ESLint 10 removed, so the server logs "doesn't export a FlatESLint class",
-- turns validation off, and never publishes diagnostics.
--
-- The flag has been unnecessary since ESLint 8.57; clearing it lets the server
-- load the public `loadESLint()` API from eslint/lib/api.js instead.
return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        eslint = {
          on_init = function(client)
            if client.settings and client.settings.experimental then
              client.settings.experimental.useFlatConfig = nil
            end
          end,
        },
      },
    },
  },
}
