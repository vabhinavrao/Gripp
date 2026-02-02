// content.js

let lastRightClickedElement = null;

// Track the element that was right-clicked
document.addEventListener('contextmenu', (event) => {
    lastRightClickedElement = event.target;
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_TWEET") {
        handleCopyTweet();
    } else if (message.type === "CLIPBOARD_SUCCESS") {
        showSuccessNotification();
    } else if (message.type === "CLIPBOARD_FAILED") {
        showToast("✗ Copy failed: " + (message.error || "Unknown error"));
    }
});

// Keyboard Shortcut listener - cached settings to avoid storage errors
let cachedShortcut = { ctrl: true, shift: true, key: 'g' };

// Load shortcut settings once on page load
try {
    if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ shortcut: { ctrl: true, shift: true, key: 'g' } }, (data) => {
            if (data && data.shortcut) {
                cachedShortcut = data.shortcut;
            }
        });
    }
} catch (e) {
    console.warn("Gripp: Could not load shortcut settings", e);
}

document.addEventListener('keydown', (event) => {
    const s = cachedShortcut;
    const ctrlOrCmd = event.ctrlKey || event.metaKey;

    if (
        (s.ctrl && !ctrlOrCmd) ||
        (!s.ctrl && ctrlOrCmd) ||
        (s.shift && !event.shiftKey) ||
        (!s.shift && event.shiftKey) ||
        (s.alt && !event.altKey) ||
        (!s.alt && event.altKey) ||
        (event.key.toLowerCase() !== s.key.toLowerCase())
    ) {
        return; // Shortcut doesn't match
    }

    // Shortcut matched!
    event.preventDefault();
    handleCopyTweetFromKeyboard();
});

// Anti-spam: Track last copied content and time
let lastCopiedHash = null;
let lastCopiedTime = 0;
const COPY_COOLDOWN_MS = 60000; // 1 minute cooldown for same content

function getContentHash(text) {
    // Simple hash for comparison
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

// Handle copy from keyboard - gets article under cursor or focused
function handleCopyTweetFromKeyboard() {
    // Try to find the tweet the user is looking at
    // Strategy: Find the article element that is most visible/central, or use hover
    const hoveredElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const tweetArticle = hoveredElement ? hoveredElement.closest('article') : null;

    if (!tweetArticle) {
        showToast("Gripp: Place cursor over a post first.");
        return;
    }

    performCopy(tweetArticle, true);
}

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

    performCopy(tweetArticle, false);
}

function performCopy(tweetArticle, fromKeyboard) {
    try {
        const textData = extractTweetData(tweetArticle);
        const formattedText = formatOutput(textData);

        if (!formattedText || formattedText.trim() === "") {
            console.warn("Gripp: Extracted text is empty.", textData);
            showToast("Gripp: Found an empty post?");
            return;
        }

        // Anti-spam check: prevent copying same content within 1 minute
        const contentHash = getContentHash(formattedText);
        const now = Date.now();

        if (contentHash === lastCopiedHash && (now - lastCopiedTime) < COPY_COOLDOWN_MS) {
            showWarningToast("Already copied");
            return;
        }

        // Update anti-spam tracking
        lastCopiedHash = contentHash;
        lastCopiedTime = now;

        // Extract Tweet URL
        let tweetUrl = "https://x.com";
        const timeElement = tweetArticle.querySelector('time');
        if (timeElement) {
            const link = timeElement.closest('a');
            if (link) {
                tweetUrl = link.href;
            }
        }

        // Send text to background script for clipboard writing
        showToast("⏳ Copying...");
        chrome.runtime.sendMessage({
            type: fromKeyboard ? "WRITE_TO_CLIPBOARD_KEYBOARD" : "WRITE_TO_CLIPBOARD",
            text: formattedText
        });

        // Save to history (non-blocking)
        try {
            saveToHistory(formattedText, tweetUrl, textData.media);
        } catch (historyErr) {
            console.warn("Gripp: History save failed.", historyErr);
        }

    } catch (e) {
        console.error("Gripp Error:", e);
        showToast("Gripp encountered an error: " + e.message);
    }
}

function saveToHistory(text, url, media) {
    // Get first few lines for preview (up to 200 chars)
    const lines = text.split('\n').filter(l => l.trim());
    let preview = '';
    for (let i = 0; i < lines.length && preview.length < 200; i++) {
        preview += lines[i] + '\n';
    }
    if (text.length > preview.length) {
        preview = preview.trim() + '...';
    }

    // Calculate word count (excluding separators, metadata, and image placeholders)
    const contentForWordCount = text
        .replace(/^Author:.*$/gm, '')  // Remove author line
        .replace(/^---$/gm, '')         // Remove separators
        .replace(/\[Image\d+\]/g, '')   // Remove image placeholders
        .replace(/\[Video\d+\]/g, '')   // Remove video placeholders
        .replace(/heading:|subheading:/g, '') // Remove heading prefixes
        .replace(/https?:\/\/\S+/gi, ''); // Remove URLs

    // Match X/Twitter word counting (refined):
    // - Words with letters (and optional numbers/apostrophes)
    // - Hashtags and mentions as single words
    // This is more lenient than previous attempt
    const words = contentForWordCount.match(/\b(?:[a-zA-Z0-9]+(?:'[a-zA-Z]+)?|[@#]\w+)\b/g);
    const wordCount = words ? words.length : 0;

    // Detect content type: article if has "heading:" or is long-form
    const isArticle = text.includes('heading:') || text.includes('subheading:') || wordCount > 300;

    // Calculate total media count
    const mediaCount = media ? (media.images || 0) + (media.videos || 0) : 0;
    const mediaDetails = media || { images: 0, videos: 0 };

    const historyItem = {
        id: crypto.randomUUID(),
        preview: preview.trim(),
        fullText: text, // Store full text
        url: url,
        timestamp: Date.now(),
        mediaCount: mediaCount,
        media: mediaDetails,
        wordCount: wordCount,
        contentType: isArticle ? 'article' : 'tweet' // NEW: Distinguish articles from tweets
    };

    try {
        chrome.storage.local.get({ history: [] }, (data) => {
            // Add new item to top, limit to 50
            const newHistory = [historyItem, ...data.history].slice(0, 50);
            chrome.storage.local.set({ history: newHistory });
        });
    } catch (e) {
        console.warn("Gripp: Verify you have 'storage' permissions in manifest.", e);
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
        if (lines.length >= 2) {
            return `${lines[0]} ${lines[1]}`;
        }
        return lines[0] || "Unknown";
    };

    const mainAuthor = getFullAuthor(userNames[0]);
    const mainHandle = getHandle(userNames[0]);

    // 2. Get all Tweet Texts
    let textBlocks = article.querySelectorAll('[data-testid="tweetText"]');

    // Helper to check if text looks like UI chrome
    const isUIText = (text) => {
        if (!text) return true;
        const trimmed = text.trim();
        if (/^[\d,.]+[KMB]?\s*(Views)?$/i.test(trimmed)) return true;
        if (/^[\d,.]+$/.test(trimmed)) return true;
        const uiPatterns = [
            /^subscribe$/i, /^follow$/i, /^repost$/i, /^like$/i, /^reply$/i, /^share$/i,
            /^quote$/i, /^bookmark$/i, /^more$/i, /^views?$/i, /^show more$/i, /^show less$/i,
            /upgrade to premium/i, /want to publish/i, /publish your own/i,
            /^·$/, /^…$/, /^\.\.\.$/, /^see more$/i, /^read more$/i
        ];
        if (uiPatterns.some(p => p.test(trimmed))) return true;
        if (trimmed.length < 3) return true;
        return false;
    };

    // Helper to normalize text for deduplication
    const normalizeText = (text) => {
        if (!text) return "";
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Helper to detect if a line is likely a heading/subheading
    const isLikelyHeading = (text, nextText) => {
        if (!text) return false;
        const trimmed = text.trim();
        if (trimmed.length < 3 || trimmed.length > 80) return false;
        if (/[.!?,;:]$/.test(trimmed) && !trimmed.endsWith('?')) return false;
        if (/\.\s+[A-Z]/.test(trimmed)) return false;
        const isShortFollowedByLong = trimmed.length < 60 && nextText && nextText.length > trimmed.length * 1.5;
        const words = trimmed.split(/\s+/);
        const isTitleCase = words.length > 1 && words.every(w => /^[A-Z#@]/.test(w) || w.length <= 2);
        const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3;
        const startsWithNumber = /^[#\d]/.test(trimmed);
        const headingPatterns = [
            /^(what|how|why|when|where|who|the|my|our|your|this|here|key|top|best|guide|intro|conclusion|summary|tldr|tl;dr)/i,
            /^[A-Z][a-z]+\s+(is|are|was|were)\s+/i,
        ];
        const matchesHeadingPattern = headingPatterns.some(p => p.test(trimmed));
        return (isShortFollowedByLong && (isTitleCase || matchesHeadingPattern)) || isAllCaps || startsWithNumber;
    };

    // Check for X Articles (long-form content) - look for the article container
    const articleContainer = article.querySelector('[data-testid="twitterArticleReadView"]');
    const isLongformArticle = articleContainer !== null;

    let mainText = "";
    let mediaInfo = { images: 0, videos: 0 };

    const contentParts = [];
    const seenText = new Set();
    let imageCounter = 0;
    let videoCounter = 0;

    // Collect all content elements
    const elements = [];

    if (isLongformArticle) {
        // ===== X ARTICLE MODE =====

        // Get article title
        const titleEl = article.querySelector('[data-testid="twitter-article-title"]');
        if (titleEl) {
            const titleText = titleEl.innerText?.trim();
            if (titleText && titleText.length > 0) {
                const rect = titleEl.getBoundingClientRect();
                elements.push({
                    type: 'title',
                    text: titleText,
                    top: rect.top,
                    element: titleEl
                });
            }
        }

        // Track processed elements to avoid duplicates
        const processedElements = new Set();

        // Helper to check if element was already processed
        const markProcessed = (el) => processedElements.add(el);
        const isProcessed = (el) => processedElements.has(el);

        // Get all longform content elements (author's text)
        // Headers level 1
        articleContainer.querySelectorAll('.longform-header-one').forEach(el => {
            if (isProcessed(el)) return;
            markProcessed(el);
            const text = el.innerText?.trim();
            if (text && text.length > 2 && !isUIText(text)) {
                const rect = el.getBoundingClientRect();
                elements.push({
                    type: 'heading1',
                    text: text,
                    top: rect.top,
                    element: el
                });
            }
        });

        // Headers level 2
        articleContainer.querySelectorAll('.longform-header-two').forEach(el => {
            if (isProcessed(el)) return;
            markProcessed(el);
            const text = el.innerText?.trim();
            if (text && text.length > 2 && !isUIText(text)) {
                const rect = el.getBoundingClientRect();
                elements.push({
                    type: 'heading2',
                    text: text,
                    top: rect.top,
                    element: el
                });
            }
        });

        // Get ALL content blocks using a comprehensive selector
        // This includes paragraphs, list items, etc.
        const contentSelectors = [
            '.longform-unstyled',           // Regular paragraphs
            '.longform-unordered-list-item', // Bullet list items
            '.longform-ordered-list-item'    // Numbered list items
        ];

        articleContainer.querySelectorAll(contentSelectors.join(', ')).forEach(el => {
            // Skip if already processed (header classes are sometimes combined)
            if (isProcessed(el)) return;

            // Skip headers (they have their own extraction above)
            if (el.classList.contains('longform-header-one') ||
                el.classList.contains('longform-header-two')) return;

            // Skip if this element is inside a tweetText (embedded tweet - handled separately)
            const isInsideTweetText = el.closest('[data-testid="tweetText"]') !== null;
            if (isInsideTweetText) return;

            // Skip if inside an embedded tweet article
            const isInEmbeddedTweet = el.closest('article[data-testid="tweet"]') !== null;
            if (isInEmbeddedTweet) return;

            markProcessed(el);

            // Get the text directly - innerText handles all nested spans correctly
            const text = el.innerText?.trim();
            if (text && text.length > 2 && !isUIText(text)) {
                const rect = el.getBoundingClientRect();

                // Determine type based on class
                let itemType = 'paragraph';
                if (el.classList.contains('longform-unordered-list-item')) {
                    itemType = 'list_item';
                } else if (el.classList.contains('longform-ordered-list-item')) {
                    itemType = 'list_item_ordered';
                }

                elements.push({
                    type: itemType,
                    text: text,
                    top: rect.top,
                    element: el
                });
            }
        });

        // Blockquotes
        articleContainer.querySelectorAll('.longform-blockquote').forEach(el => {
            if (isProcessed(el)) return;
            markProcessed(el);
            const text = el.innerText?.trim();
            if (text && text.length > 2 && !isUIText(text)) {
                const rect = el.getBoundingClientRect();
                elements.push({
                    type: 'blockquote',
                    text: text,
                    top: rect.top,
                    element: el
                });
            }
        });

        // Also try to get any rich text components that might contain paragraphs
        // This is a fallback for articles that use a different structure
        articleContainer.querySelectorAll('[data-testid="longformRichTextComponent"]').forEach(richTextEl => {
            // Get all direct text content divs that weren't already processed
            richTextEl.querySelectorAll('div[data-offset-key]').forEach(el => {
                if (isProcessed(el)) return;

                // Skip if parent was already processed
                let parent = el.parentElement;
                while (parent && parent !== richTextEl) {
                    if (isProcessed(parent)) return;
                    parent = parent.parentElement;
                }

                const text = el.innerText?.trim();
                if (text && text.length > 2 && !isUIText(text)) {
                    markProcessed(el);
                    const rect = el.getBoundingClientRect();
                    elements.push({
                        type: 'paragraph',
                        text: text,
                        top: rect.top,
                        element: el
                    });
                }
            });
        });
    }

    // ===== EMBEDDED TWEETS (from tweetText) =====
    // Need to get the closest tweet container for each text block to properly attribute
    textBlocks.forEach(el => {
        const text = el.innerText?.trim();
        if (text && !isUIText(text)) {
            const rect = el.getBoundingClientRect();

            // Find the closest embedded tweet this belongs to
            const parentTweet = el.closest('article[data-testid="tweet"]');
            let author = null;
            let isNested = false;

            if (parentTweet) {
                // Get the author from first User-Name in this tweet (not descendants)
                const authorEl = parentTweet.querySelector(':scope > div [data-testid="User-Name"]') ||
                    parentTweet.querySelector('[data-testid="User-Name"]');
                author = getHandle(authorEl);

                // Check if this tweet is nested (inside another tweet)
                const grandparentTweet = parentTweet.parentElement?.closest('article[data-testid="tweet"]');
                isNested = grandparentTweet !== null;
            }

            elements.push({
                type: 'embedded_tweet',
                text: text,
                top: rect.top,
                author: author,
                isNested: isNested,
                element: el
            });
        }
    });

    // ===== IMAGES =====
    const allImages = article.querySelectorAll('[data-testid="tweetPhoto"]');
    allImages.forEach(el => {
        const rect = el.getBoundingClientRect();
        elements.push({
            type: 'image',
            top: rect.top,
            element: el
        });
    });

    // ===== VIDEOS =====
    const allVideos = article.querySelectorAll('[data-testid="videoPlayer"]');
    allVideos.forEach(el => {
        const rect = el.getBoundingClientRect();
        elements.push({
            type: 'video',
            top: rect.top,
            element: el
        });
    });

    // Sort ALL elements by vertical position
    elements.sort((a, b) => a.top - b.top);

    // Track current embedded tweet for grouping
    let currentQuoteAuthor = null;

    // Process elements in order
    for (let i = 0; i < elements.length; i++) {
        const item = elements[i];

        if (item.type === 'title') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                // Close any open quote
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`heading: ${item.text}`);
            }
        } else if (item.type === 'heading1') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`heading: ${item.text}`);
            }
        } else if (item.type === 'heading2') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`subheading: ${item.text}`);
            }
        } else if (item.type === 'blockquote') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`> ${item.text}`);
            }
        } else if (item.type === 'paragraph') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(item.text);
            }
        } else if (item.type === 'list_item') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`• ${item.text}`);
            }
        } else if (item.type === 'list_item_ordered') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);
                if (currentQuoteAuthor) {
                    contentParts.push(`""`);
                    currentQuoteAuthor = null;
                }
                contentParts.push(`  ${item.text}`);
            }
        } else if (item.type === 'embedded_tweet') {
            const normalized = normalizeText(item.text);
            if (!seenText.has(normalized)) {
                seenText.add(normalized);

                // Each embedded tweet gets its own attribution
                if (item.author && item.author !== mainHandle && item.author !== 'Unknown') {
                    // Close any previous quote
                    if (currentQuoteAuthor && currentQuoteAuthor !== item.author) {
                        contentParts.push(`""`);
                    }

                    // Start new quoted section if different author
                    if (currentQuoteAuthor !== item.author) {
                        const nestedPrefix = item.isNested ? ' (nested)' : '';
                        contentParts.push(`\n--- Quoted Tweet from ${item.author}${nestedPrefix} ---`);
                        contentParts.push(`""${item.text}`);
                        currentQuoteAuthor = item.author;
                    } else {
                        // Same author, continue quote
                        contentParts.push(item.text);
                    }
                } else {
                    // No clear author or same as main author - treat as regular content
                    if (currentQuoteAuthor) {
                        contentParts.push(`""`);
                        currentQuoteAuthor = null;
                    }
                    contentParts.push(item.text);
                }
            }
        } else if (item.type === 'image') {
            imageCounter++;
            mediaInfo.images++;
            contentParts.push(`[Image${imageCounter}]`);
        } else if (item.type === 'video') {
            videoCounter++;
            mediaInfo.videos++;
            contentParts.push(`[Video${videoCounter}]`);
        }
    }

    // Close any open quote
    if (currentQuoteAuthor) {
        contentParts.push(`""`);
    }

    mainText = contentParts.join('\n\n');

    // Fallback: if nothing found, use original tweetText approach
    if (!mainText.trim() && textBlocks.length > 0) {
        textBlocks.forEach(block => {
            const text = block.innerText?.trim();
            if (text && !isUIText(text)) {
                const normalized = normalizeText(text);
                if (!seenText.has(normalized)) {
                    seenText.add(normalized);
                    contentParts.push(text);
                }
            }
        });
        mainText = contentParts.join('\n\n');
    }

    return {
        author: mainAuthor,
        text: mainText,
        quoted: [],
        media: mediaInfo
    };
}

function formatOutput(data) {
    // Clean and format the main text
    const cleanedMainText = cleanText(data.text);

    // Build media summary for header
    let mediaSummary = '';
    if (data.media && (data.media.images > 0 || data.media.videos > 0)) {
        let parts = [];
        if (data.media.images > 0) parts.push(`${data.media.images} image${data.media.images === 1 ? '' : 's'}`);
        if (data.media.videos > 0) parts.push(`${data.media.videos} video${data.media.videos === 1 ? '' : 's'}`);
        mediaSummary = `  📷 ${parts.join(', ')}`;
    }

    // Build output in a clear, structured format for both humans and AI
    let output = `Author: ${data.author}${mediaSummary}\n`;
    output += `---\n\n`;  // Dynamic separator (will be styled in UI)
    output += `${cleanedMainText}\n`;

    if (data.quoted && data.quoted.length > 0) {
        output += `\n---\n`;  // Dynamic separator
        output += `Quoted Posts (${data.quoted.length}):\n`;

        data.quoted.forEach((quote, index) => {
            output += `\n[Quote ${index + 1}] ${quote.author}\n`;
            output += `${cleanText(quote.text)}\n`;

            // Media detected?
            const m = quote.media;
            let mediaParts = [];
            if (m.images > 0) mediaParts.push(`${m.images} image${m.images === 1 ? '' : 's'}`);
            if (m.videos > 0) mediaParts.push(`${m.videos} video${m.videos === 1 ? '' : 's'}`);

            if (mediaParts.length > 0) {
                output += `[Attachments: ${mediaParts.join(', ')}]\n`;
            }
        });
    }

    return output.trim();
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

function showWarningToast(msg) {
    // Yellow warning toast for anti-spam
    const existing = document.getElementById("gripp-warning");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "gripp-warning";
    toast.innerHTML = '<span style="margin-right: 8px;">⚠</span>' + msg;
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.backgroundColor = "#f5a623";
    toast.style.color = "#000";
    toast.style.padding = "12px 20px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "2147483647";
    toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "500";
    toast.style.boxShadow = "0 4px 12px rgba(245, 166, 35, 0.3)";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    toast.style.pointerEvents = "none";

    document.body.appendChild(toast);

    void toast.offsetWidth;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function showSuccessNotification() {
    // Subtle success notification
    const existing = document.getElementById("gripp-success");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "gripp-success";
    notification.innerHTML = '<span style="margin-right: 8px;">✓</span>Tweet copied to clipboard';
    notification.style.position = "fixed";
    notification.style.bottom = "30px";
    notification.style.right = "30px";
    notification.style.backgroundColor = "#00ba7c";
    notification.style.color = "#fff";
    notification.style.padding = "12px 20px";
    notification.style.borderRadius = "8px";
    notification.style.zIndex = "2147483647";
    notification.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    notification.style.fontSize = "14px";
    notification.style.fontWeight = "500";
    notification.style.boxShadow = "0 4px 20px rgba(0, 186, 124, 0.3), 0 0 0 1px rgba(0, 186, 124, 0.1)";
    notification.style.opacity = "0";
    notification.style.transform = "translateY(10px)";
    notification.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    notification.style.pointerEvents = "none";

    document.body.appendChild(notification);

    // Trigger reflow
    void notification.offsetWidth;

    notification.style.opacity = "1";
    notification.style.transform = "translateY(0)";

    setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transform = "translateY(-10px)";
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}
