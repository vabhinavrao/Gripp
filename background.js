// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gripp-copy-post",
    title: "Copy full post with Gripp",
    contexts: ["selection", "page", "link", "editable", "image", "video", "audio"] // broad contexts to ensure it appears
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gripp-copy-post" && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "COPY_TWEET",
      info: info
    }).catch(err => {
        console.warn("Could not send message to content script. Is it loaded?", err);
    });
  }
});
