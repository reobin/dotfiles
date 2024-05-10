return {
  "gabrielpoca/replacer.nvim",
  keys = {
    {
      "<leader>R",
      function()
        require("replacer").run()
      end,
      desc = "run replacer.nvim",
    },
  },
}
