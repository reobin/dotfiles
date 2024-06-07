local wezterm = require("wezterm")

local config = wezterm.config_builder()

config.font_size = 16.0
config.window_decorations = "RESIZE"
config.hide_tab_bar_if_only_one_tab = true

config.colors = {
	background = "#161617",
	foreground = "#c9c7cd",
	cursor_bg = "#757581",
	cursor_fg = "#c9c7cd",
	selection_bg = "#757581",
	selection_fg = "#c9c7cd",
	ansi = {
		"#27272a", -- black normal
		"#f5a191", -- red normal
		"#90b99f", -- green normal
		"#e6b99d", -- yellow normal
		"#aca1cf", -- blue normal
		"#e29eca", -- magenta normal
		"#ea83a5", -- cyan normal
		"#27272a", -- black normal
	},
	brights = {
		"#353539", -- black bright
		"#ffae9f", -- red bright
		"#9dc6ac", -- green bright
		"#f0c5a9", -- yellow bright
		"#b9aeda", -- blue bright
		"#ecaad6", -- magenta bright
		"#f591b2", -- cyan bright
		"#cac9dd", -- white bright
	},
}

return config
