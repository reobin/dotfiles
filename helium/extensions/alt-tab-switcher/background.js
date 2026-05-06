chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const activeIndex = tabs.findIndex((t) => t.active);
    if (activeIndex === -1) return;

    let nextIndex;
    if (command === "next-tab") {
      nextIndex = (activeIndex + 1) % tabs.length;
    } else if (command === "prev-tab") {
      nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }

    chrome.tabs.update(tabs[nextIndex].id, { active: true });
  });
});
