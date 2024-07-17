local wezterm = require("wezterm")

local config = wezterm.config_builder()

config.font_size = 16.0
config.window_decorations = "RESIZE"
config.hide_tab_bar_if_only_one_tab = true

config.colors = {
	foreground = "#f2f4f8",
	background = "#161616",
	cursor_bg = "#f2f4f8",
	cursor_border = "#f2f4f8",
	cursor_fg = "#161616",
	compose_cursor = "#3ddbd9",
	selection_bg = "#2a2a2a",
	selection_fg = "#f2f4f8",
	scrollbar_thumb = "#7b7c7e",
	split = "#0c0c0c",
	visual_bell = "#f2f4f8",
	ansi = {
		"#282828",
		"#ee5396",
		"#25be6a",
		"#08bdba",
		"#78a9ff",
		"#be95ff",
		"#33b1ff",
		"#dfdfe0",
	},
	brights = {
		"#484848",
		"#f16da6",
		"#46c880",
		"#2dc7c4",
		"#8cb6ff",
		"#c8a5ff",
		"#52bdff",
		"#e4e4e5",
	},
	indexed = {
		[16] = "#ff7eb6",
		[17] = "#3ddbd9",
	},
	tab_bar = {
		background = "#0c0c0c",
		inactive_tab_edge = "#0c0c0c",
		inactive_tab_edge_hover = "#252525",
		active_tab = {
			bg_color = "#7b7c7e",
			fg_color = "#161616",
			intensity = "Normal",
			italic = false,
			strikethrough = false,
			underline = "None",
		},
		inactive_tab = {
			bg_color = "#252525",
			fg_color = "#b6b8bb",
			intensity = "Normal",
			italic = false,
			strikethrough = false,
			underline = "None",
		},
		inactive_tab_hover = {
			bg_color = "#353535",
			fg_color = "#f2f4f8",
			intensity = "Normal",
			italic = false,
			strikethrough = false,
			underline = "None",
		},
		new_tab = {
			bg_color = "#161616",
			fg_color = "#b6b8bb",
			intensity = "Normal",
			italic = false,
			strikethrough = false,
			underline = "None",
		},
		new_tab_hover = {
			bg_color = "#353535",
			fg_color = "#f2f4f8",
			intensity = "Normal",
			italic = false,
			strikethrough = false,
			underline = "None",
		},
	},
}

return config
