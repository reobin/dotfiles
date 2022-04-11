local vimp = require("vimp")

local helpers = {}

--- Reloads init.lua and all its linked config files
function helpers.reloadNeovimConfig()
  vimp.unmap_all() -- remove all previously added vimpeccable maps

  vim.cmd("silent wa") -- make sure all open buffers are saved

  for packagename in pairs(package.loaded) do
    if packagename:match("^config%..*") then
      print("reloading", packagename)
      package.loaded[packagename] = nil
    end
  end

  dofile(vim.fn.stdpath("config") .. "/init.lua") -- execute our vimrc lua file again to add back our maps

  print("init.lua reloaded")
end

return helpers
