const { unmapAllExcept } = api;

// Tabs, windows and history stay with Helium and the tab-keys extension.
unmapAllExcept([
  "f", "af", "gf", "cf",
  "i", "I",
  "j", "k", "h", "l", "d", "e", "u", "gg", "G",
  "[[", "]]",
  "v",
  "/", "n", "N",
  "zi", "zo", "zr",
]);

settings.scrollStepSize = 100;
settings.smoothScroll = false;
settings.hintAlign = "left";
