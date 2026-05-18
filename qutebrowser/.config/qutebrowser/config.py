import subprocess


def system_prefers_dark():
    try:
        color_scheme = subprocess.check_output(
            ['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme'],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False

    return 'dark' in color_scheme.lower()


config.load_autoconfig()

prefers_dark = system_prefers_dark()

c.colors.webpage.preferred_color_scheme = 'auto'
c.colors.webpage.darkmode.enabled = prefers_dark
c.colors.webpage.bg = '#111111' if prefers_dark else 'white'

c.tabs.position = 'left'
c.tabs.width = 36
c.tabs.title.format = '{index}'
c.tabs.favicons.scale = 1.0
c.tabs.padding = {'top': 2, 'bottom': 2, 'left': 2, 'right': 2}
c.tabs.indicator.width = 0
