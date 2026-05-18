import os
import tomllib

config.load_autoconfig()

theme_path = os.path.expanduser('~/.config/omarchy/current/theme/colors.toml')
light_mode_path = os.path.expanduser('~/.config/omarchy/current/theme/light.mode')
is_dark = not os.path.exists(light_mode_path)

c.colors.webpage.darkmode.enabled = is_dark

if os.path.exists(theme_path):
    with open(theme_path, 'rb') as f:
        theme = tomllib.load(f)
    bg = theme['background']
    fg = theme['foreground']
    accent = theme['accent']
    sel_bg = theme['selection_background']
    sel_fg = theme['selection_foreground']
else:
    bg = '#141415'
    fg = '#cdcdcd'
    accent = '#7e98e8'
    sel_bg = '#333738'
    sel_fg = '#cdcdcd'
    is_dark = True

c.colors.webpage.preferred_color_scheme = 'dark' if is_dark else 'light'
c.colors.webpage.bg = bg

c.colors.tabs.bar.bg = bg
c.colors.tabs.even.bg = bg
c.colors.tabs.even.fg = fg
c.colors.tabs.odd.bg = bg
c.colors.tabs.odd.fg = fg
c.colors.tabs.selected.even.bg = sel_bg
c.colors.tabs.selected.even.fg = sel_fg
c.colors.tabs.selected.odd.bg = sel_bg
c.colors.tabs.selected.odd.fg = sel_fg
c.colors.tabs.indicator.start = accent
c.colors.tabs.indicator.stop = accent

c.tabs.position = 'left'
c.tabs.width = 28
c.tabs.title.format = ''
c.tabs.title.alignment = 'center'
c.tabs.favicons.scale = 1.0
c.tabs.padding = {'top': 6, 'bottom': 6, 'left': 6, 'right': 6}
c.tabs.indicator.width = 0
