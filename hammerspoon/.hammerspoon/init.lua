local thudTitle = "thud.sh"
local defaultWidth = 240

local function shellQuote(value)
  return "'" .. tostring(value):gsub("'", "'\\''") .. "'"
end

local function thudPath()
  local output, ok = hs.execute("/bin/zsh -lc 'command -v thud.sh'", true)
  if not ok then
    hs.alert.show("thud.sh not found")
    return nil
  end

  return output:gsub("%s+$", "")
end

local function thudWindow()
  for _, window in ipairs(hs.window.orderedWindows()) do
    local app = window:application()
    if app and app:name() == "Ghostty" and window:title() == thudTitle then
      return window
    end
  end

  return nil
end

local function launchThud()
  local command = thudPath()
  if not command then
    return
  end

  hs.execute(
    "/Applications/Ghostty.app/Contents/MacOS/ghostty --title="
      .. shellQuote(thudTitle)
      .. " -e "
      .. shellQuote(command)
      .. " >/dev/null 2>&1 &",
    true
  )
end

local function placeLeft(window, width, screen)
  local frame = screen:frame()
  window:setFrame({
    x = frame.x,
    y = frame.y,
    w = width,
    h = frame.h,
  }, 0)
end

local function placeRightOfThud(window, width, screen)
  local frame = screen:frame()
  window:setFrame({
    x = frame.x + width,
    y = frame.y,
    w = frame.w - width,
    h = frame.h,
  }, 0)
end

local function arrangeThud(window, previousWindow, width, screen)
  placeLeft(window, width, screen)

  if previousWindow and previousWindow:id() ~= window:id() and previousWindow:screen() == screen then
    placeRightOfThud(previousWindow, width, screen)
    previousWindow:focus()
  end
end

local function showThud(params)
  local previousWindow = hs.window.frontmostWindow()
  local previousScreen = previousWindow and previousWindow:screen()
  local screen = previousScreen or hs.screen.mainScreen()
  local width = tonumber(params and params.width) or defaultWidth
  local window = thudWindow()

  if window then
    arrangeThud(window, previousWindow, width, screen)
    return
  end

  launchThud()

  hs.timer.waitUntil(thudWindow, function()
    local foundWindow = thudWindow()
    if not foundWindow then
      return
    end

    arrangeThud(foundWindow, previousWindow, width, screen)
  end, 0.05)
end

hs.urlevent.bind("thud", function(_, params)
  showThud(params)
end)
hs.hotkey.bind({ "ctrl", "alt", "cmd" }, "t", function()
  showThud({})
end)
