// content.js

let lastRightClickedElement = null;

// Track the element that was right-clicked
document.addEventListener('contextmenu', (event) => {
    lastRightClickedElement = event.target;
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "COPY_TWEET") {
        handleCopyTweet();
    }
});

function handleCopyTweet() {
    if (!lastRightClickedElement) {
        showToast("Gripp: Please right-click directly on the post text.");
        return;
    }

    const tweetArticle = lastRightClickedElement.closest('article');

    if (!tweetArticle) {
        showToast("Gripp: No X post found under cursor.");
        return;
    }

    try {
        const textData = extractTweetData(tweetArticle);
        const formattedText = formatOutput(textData);

        if (!formattedText || formattedText.trim() === "") {
            console.warn("Gripp: Extracted text is empty.", textData);
            showToast("Gripp: Found an empty post?");
            return;
        }

        // Use fallback clipboard method for content scripts
        copyToClipboard(formattedText);

    } catch (e) {
        console.error("Gripp Error:", e);
        showToast("Gripp encountered an error: " + e.message);
    }
}

// Robust clipboard copy that works in content scripts
function copyToClipboard(text) {
    // Try modern API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast("Post copied to clipboard!");
            })
            .catch(err => {
                console.warn("Gripp: Modern clipboard API failed, trying fallback...", err);
                fallbackCopyToClipboard(text);
            });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Fallback using execCommand (works in older browsers and some security contexts)
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("Post copied to clipboard!");
        } else {
            showToast("Gripp: Copy failed. Please try again.");
        }
    } catch (err) {
        console.error("Gripp: Fallback copy failed", err);
        showToast("Gripp: Copy failed. Check console.");
    }

    document.body.removeChild(textArea);
}

function extractTweetData(article) {
    // 1. Get all User-Names (Author blocks)
    const userNames = article.querySelectorAll('[data-testid="User-Name"]');

    // Helper to get raw handle from User-Name block
    const getHandle = (el) => {
        if (!el) return "Unknown";
        const text = el.innerText || "";
        const lines = text.split('\n');
        const handle = lines.find(l => l.startsWith('@'));
        return handle || lines[0] || "Unknown";
    };

    // Helper to get display name + handle
    const getFullAuthor = (el) => {
        if (!el) return "Unknown";
        const text = el.innerText || "";
        const lines = text.split('\n').filter(l => l.trim());
        // Usually: Display Name, @handle, maybe timestamp
        if (lines.length >= 2) {
            return `${lines[0]} ${lines[1]}`;
        }
        return lines[0] || "Unknown";
    };

    const mainAuthor = getFullAuthor(userNames[0]);

    // 2. Get all Tweet Texts
    const textBlocks = article.querySelectorAll('[data-testid="tweetText"]');
    const mainText = textBlocks[0] ? textBlocks[0].innerText : "";

    // 3. Collect ALL quoted tweets (everything after the first text block)
    let quotedTweets = [];

    if (textBlocks.length > 1) {
        for (let i = 1; i < textBlocks.length; i++) {
            const quoteText = textBlocks[i].innerText;

            // Try to find corresponding author
            let quoteAuthor = "Quoted Tweet";
            if (userNames.length > i) {
                quoteAuthor = getHandle(userNames[i]);
            }

            quotedTweets.push({
                author: quoteAuthor,
                text: quoteText
            });
        }
    }

    return {
        author: mainAuthor,
        text: mainText,
        quoted: quotedTweets // Now an array of all quotes
    };
}

function formatOutput(data) {
    // Clean and format the main text
    const cleanedMainText = cleanText(data.text);

    let output = `${data.author}\n\n${cleanedMainText}\n`;

    if (data.quoted && data.quoted.length > 0) {
        data.quoted.forEach((quote, index) => {
            output += `\n--- Quoted Post ---\n`;
            output += `${quote.author}\n`;
            output += `${cleanText(quote.text)}\n`;
        });
    }

    return output;
}

// Clean text to be human-readable like Twitter display
function cleanText(text) {
    if (!text) return "";

    let lines = text.split('\n');
    let result = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Skip empty lines but preserve paragraph breaks
        if (line === "") {
            // Only add empty line if previous wasn't empty (avoid multiple blank lines)
            if (result.length > 0 && result[result.length - 1] !== "") {
                result.push("");
            }
            continue;
        }

        // Check if this line should be joined to the previous line
        // Join if: line starts with @, or line is a URL continuation, or line is punctuation/comma
        const shouldJoinToPrevious = (
            line.startsWith('@') ||
            line.startsWith(',') ||
            line.startsWith('.') ||
            line.startsWith('…') ||
            line.match(/^[a-z0-9\-_.\/]+\/?$/i) // URL fragment (no spaces, looks like path)
        );

        if (shouldJoinToPrevious && result.length > 0 && result[result.length - 1] !== "") {
            // Join to previous line with a space
            result[result.length - 1] += ' ' + line;
        } else {
            result.push(line);
        }
    }

    // Clean up the result
    let cleaned = result.join('\n');

    // Fix common URL patterns that got broken
    // Pattern: "https://\nsome.domain/path" -> "https://some.domain/path"
    cleaned = cleaned.replace(/https?:\/\/\s+/g, match => match.trim());
    cleaned = cleaned.replace(/http:\/\/\s+/g, 'http://');
    cleaned = cleaned.replace(/https:\/\/\s+/g, 'https://');

    // Remove excessive spaces
    cleaned = cleaned.replace(/  +/g, ' ');

    // Remove more than 2 consecutive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
}

function showToast(msg) {
    // Remove existing toast if any
    const existing = document.getElementById("gripp-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "gripp-toast";
    toast.textContent = msg;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.backgroundColor = "#222";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "2147483647"; // Max z-index
    toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease-in-out";
    toast.style.pointerEvents = "none";

    document.body.appendChild(toast);

    // Trigger reflow
    void toast.offsetWidth;

    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
