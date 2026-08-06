const COMMANDS = {
  "switch-next": { offset: 1, move: false },
  "switch-previous": { offset: -1, move: false },
  "move-next": { offset: 1, move: true },
  "move-previous": { offset: -1, move: true },
};

chrome.commands.onCommand.addListener(async (command) => {
  const action = COMMANDS[command];
  if (!action) return;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const active = tabs.find((tab) => tab.active);
  if (!active) return;

  // Chromium silently clamps a move across the pinned boundary, which would
  // make the shortcut a dead key there. Moves stay inside the active tab's own
  // section; switching still spans the whole strip.
  const scope = action.move
    ? tabs.filter((tab) => tab.pinned === active.pinned)
    : tabs;

  const index = (scope.indexOf(active) + action.offset + scope.length) % scope.length;
  const target = scope[index];

  if (action.move) {
    await chrome.tabs.move(active.id, { index: target.index });
  } else {
    await chrome.tabs.update(target.id, { active: true });
  }
});
