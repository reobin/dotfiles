const NO_GROUP = -1;

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

  const next = scope.indexOf(active) + action.offset;
  const wrapped = next < 0 || next >= scope.length;
  const target = scope[(next + scope.length) % scope.length];

  if (!action.move) {
    await chrome.tabs.update(target.id, { active: true });
    return;
  }

  if (scope.length < 2) return;

  // A group boundary costs a press of its own, in both directions, and the tab
  // holds its position while it happens: it leaves the group it is in before it
  // can move away, and joins the group it sits against before it can move in.
  // Chromium would otherwise fold the exit into the move, leaving a group free
  // to fall out of and two presses to get back into.
  if (active.groupId !== NO_GROUP && (wrapped || target.groupId !== active.groupId)) {
    await chrome.tabs.ungroup(active.id);
    return;
  }

  if (!wrapped && active.groupId === NO_GROUP && target.groupId !== NO_GROUP) {
    await chrome.tabs.group({ groupId: target.groupId, tabIds: active.id });
    return;
  }

  await chrome.tabs.move(active.id, { index: target.index });
});
