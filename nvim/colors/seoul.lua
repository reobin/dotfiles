vim.g.colors_name = "seoul"

local lush = require "lush"
local base = require "seoulbones"

local specs =
  lush.extends({base}).with(
  function()
    return {
      MatchParen {fg = "#F7E0B3"}
    }
  end
)

lush(specs)
