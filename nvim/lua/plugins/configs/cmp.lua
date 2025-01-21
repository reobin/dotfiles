return {
  "saghen/blink.cmp",
  dependencies = "rafamadriz/friendly-snippets",
  version = "*",
  opts = {
    keymap = { preset = "enter" },
    sources = {
      default = { "lsp", "path", "snippets", "buffer" },
      cmdline = {},
    },
    completion = { documentation = { auto_show = true } },
  },
  opts_extend = { "sources.default" },
}
