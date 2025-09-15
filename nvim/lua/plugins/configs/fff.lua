return {
  "dmtrKovalenko/fff.nvim",
  build = "cargo build --release",
  opts = {
    layout = {
      prompt_position = "top",
      preview_size = 0.25
    },
  },
  keys = {
    {
      "ff",
      function()
        require("fff").find_files()
      end,
      desc = "Open file picker",
    },
  },
}
