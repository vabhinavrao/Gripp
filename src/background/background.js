// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gripp-copy-post",
    title: "Copy full post with Gripp",
    contexts: ["selection", "page", "link", "editable", "image", "video", "audio"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gripp-copy-post" && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_TWEET"
    }).catch(err => {
      console.warn("Could not send message to content script. Is it loaded?", err);
    });
  }
});

// Listen for extracted text from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "WRITE_TO_CLIPBOARD" || message.type === "WRITE_TO_CLIPBOARD_KEYBOARD") {
    writeToClipboard(message.text, sender.tab.id);
  }
  return true;
});

async function writeToClipboard(text, tabId) {
  // Log content size for debugging long article issues
  const contentSize = text.length;
  const contentKB = (contentSize / 1024).toFixed(2);
  console.log(`Gripp: Attempting to copy ${contentSize} chars (${contentKB} KB) to clipboard`);

  try {
    // Inject script to write to clipboard in page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (textToWrite) => {
        // This runs in page context where clipboard API works
        const size = textToWrite.length;
        console.log(`Gripp (page context): Writing ${size} chars to clipboard`);

        try {
          await navigator.clipboard.writeText(textToWrite);
          return { success: true, size: size };
        } catch (err) {
          return {
            success: false,
            error: err.message || 'Unknown clipboard error',
            size: size
          };
        }
      },
      args: [text]
    });

    // The result is an array, get the first one
    const result = results?.[0]?.result;

    if (result) {
      if (result.success) {
        console.log(`Gripp: Successfully copied ${result.size} chars to clipboard`);

        // Notify content script of success
        chrome.tabs.sendMessage(tabId, {
          type: "CLIPBOARD_SUCCESS"
        }).catch(err => console.warn("Could not notify tab:", err));
      } else {
        console.error(`Gripp: Clipboard write failed for ${result.size} chars:`, result.error);

        // Provide user-friendly error messages
        let errorMsg = "Sorry, please try again";

        // Check for specific error types
        if (result.error && result.error.includes("not focused")) {
          errorMsg = "Please click the X tab and try again";
        }

        chrome.tabs.sendMessage(tabId, {
          type: "CLIPBOARD_FAILED",
          error: errorMsg
        }).catch(err => console.warn("Could not notify tab:", err));
      }
    } else {
      // Result might be a pending Promise, wait a bit and assume success
      console.log("Gripp: Clipboard result pending, assuming success");
      chrome.tabs.sendMessage(tabId, {
        type: "CLIPBOARD_SUCCESS"
      }).catch(err => console.warn("Could not notify tab:", err));
    }
  } catch (err) {
    console.error("Gripp: Script injection failed:", err);

    chrome.tabs.sendMessage(tabId, {
      type: "CLIPBOARD_FAILED",
      error: "Sorry, please try again"
    }).catch(e => console.warn("Notify failed:", e));
  }
}
