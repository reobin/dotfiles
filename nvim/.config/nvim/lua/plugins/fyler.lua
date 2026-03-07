return {
  "A7Lavinraj/fyler.nvim",
  branch = "stable",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    integrations = {
      icon = "nvim_web_devicons",
    },
    views = {
      finder = {
        confirm_simple = true,
      },
    },
  },
  keys = {
    { "=", "<cmd>Fyler<cr>" },
  },
}
