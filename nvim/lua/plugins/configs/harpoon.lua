return {
  "ThePrimeagen/harpoon",
  branch = "harpoon2",
  dependencies = { "nvim-lua/plenary.nvim" },
  config = function()
    local harpoon = require("harpoon")
    harpoon.setup({ settings = { save_on_toggle = true } })

    vim.keymap.set("n", "<leader>h", function()
      harpoon.ui:toggle_quick_menu(harpoon:list())
    end)
    vim.keymap.set("n", "<leader>a", function()
      harpoon:list():add()
    end)
  end,
}
