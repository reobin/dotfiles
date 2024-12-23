vim.api.nvim_create_user_command("MasonInstallAll", function()
  vim.cmd("MasonInstall lua-language-server typescript-language-server stylua prettier gopls css-lsp eslint-lsp")
end, {})
