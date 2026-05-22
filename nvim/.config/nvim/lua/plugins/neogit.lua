return {
  "NeogitOrg/neogit",
  cmd = "Neogit",
  dependencies = {
    "sindrets/diffview.nvim",
    "folke/snacks.nvim",
  },
  opts = {
    kind = "floating",
    floating = {
      width = 0.9,
      height = 0.9,
    },
    status = {
      HEAD_folded = true,
    },
  },
  keys = {
    { "<leader>gg", "<cmd>Neogit<cr>", desc = "Neogit" },
  },
}
