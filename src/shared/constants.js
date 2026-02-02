// src/shared/constants.js
// Shared constants used across the extension

// Storage
export const STORAGE_VERSION = 2;
export const MAX_HISTORY_ITEMS = 50;
export const STORAGE_QUOTA_MB = 10;

// Anti-spam
export const COPY_COOLDOWN_MS = 60000; // 1 minute

// UI
export const TOAST_DURATION_MS = 3000;
export const SUCCESS_NOTIFICATION_DURATION_MS = 2500;
export const WARNING_NOTIFICATION_DURATION_MS = 2000;

// Content extraction
export const MIN_TEXT_LENGTH = 3;
export const MAX_ARTICLE_SIZE_KB = 100;
export const PREVIEW_LINE_COUNT = 4;
export const PREVIEW_CHAR_LIMIT = 200;

// Clipboard
export const MAX_CLIPBOARD_SIZE_KB = 100;

// Theme
export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

// Default shortcut
export const DEFAULT_SHORTCUT = {
    ctrl: true,
    shift: true,
    alt: false,
    key: 'g'
};

// Message types (for chrome.runtime.sendMessage)
export const MESSAGE_TYPES = {
    EXTRACT_TWEET: 'EXTRACT_TWEET',
    WRITE_TO_CLIPBOARD: 'WRITE_TO_CLIPBOARD',
    WRITE_TO_CLIPBOARD_KEYBOARD: 'WRITE_TO_CLIPBOARD_KEYBOARD',
    CLIPBOARD_SUCCESS: 'CLIPBOARD_SUCCESS',
    CLIPBOARD_FAILED: 'CLIPBOARD_FAILED'
};

// DOM selectors for X/Twitter
export const SELECTORS = {
    ARTICLE: 'article',
    USER_NAME: '[data-testid="User-Name"]',
    TWEET_TEXT: '[data-testid="tweetText"]',
    TWEET_PHOTO: '[data-testid="tweetPhoto"]',
    VIDEO_PLAYER: '[data-testid="videoPlayer"]',
    ARTICLE_CONTAINER: '[data-testid="twitterArticleReadView"]',
    ARTICLE_TITLE: '[data-testid="twitter-article-title"]',
    LONGFORM_RICH_TEXT: '[data-testid="longformRichTextComponent"]'
};

// CSS classes for longform articles
export const LONGFORM_CLASSES = {
    HEADER_ONE: 'longform-header-one',
    HEADER_TWO: 'longform-header-two',
    UNSTYLED: 'longform-unstyled',
    BLOCKQUOTE: 'longform-blockquote',
    UNORDERED_LIST_ITEM: 'longform-unordered-list-item',
    ORDERED_LIST_ITEM: 'longform-ordered-list-item'
};
