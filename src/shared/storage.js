// src/shared/storage.js
// Centralized storage management with schema versioning

export const STORAGE_VERSION = 2;
export const MAX_HISTORY_ITEMS = 50;

/**
 * Storage schema for article data
 * @typedef {Object} ArticleData
 * @property {string} id - Unique identifier
 * @property {string} url - Source URL
 * @property {string} preview - Short preview text
 * @property {string} fullText - Complete article text
 * @property {number} timestamp - Creation timestamp
 * @property {number} mediaCount - Total media count
 * @property {Object} media - Media details
 * @property {number} media.images - Number of images
 * @property {number} media.videos - Number of videos
 * @property {number} version - Schema version
 */

/**
 * Gets history from storage with automatic migration
 * @returns {Promise<ArticleData[]>} - Array of article data
 */
export async function getHistory() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['history', 'version'], async (data) => {
            let history = data.history || [];
            const currentVersion = data.version || 1;

            // Migrate if needed
            if (currentVersion < STORAGE_VERSION) {
                history = await migrateStorage(history, currentVersion);
            }

            resolve(history);
        });
    });
}

/**
 * Saves an article to history
 * @param {ArticleData} article - Article data to save
 * @returns {Promise<void>}
 */
export async function saveToHistory(article) {
    const history = await getHistory();

    // Add version to article
    article.version = STORAGE_VERSION;

    // Add to top, limit to max items
    const newHistory = [article, ...history].slice(0, MAX_HISTORY_ITEMS);

    return new Promise((resolve) => {
        chrome.storage.local.set({
            history: newHistory,
            version: STORAGE_VERSION,
            lastUpdated: Date.now()
        }, resolve);
    });
}

/**
 * Clears all history
 * @returns {Promise<void>}
 */
export async function clearHistory() {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            history: [],
            version: STORAGE_VERSION
        }, resolve);
    });
}

/**
 * Searches history by text query
 * @param {string} query - Search query
 * @returns {Promise<ArticleData[]>} - Filtered articles
 */
export async function searchHistory(query) {
    const history = await getHistory();
    const lowercaseQuery = query.toLowerCase();

    return history.filter(item =>
        item.fullText.toLowerCase().includes(lowercaseQuery) ||
        item.url.toLowerCase().includes(lowercaseQuery)
    );
}

/**
 * Migrates storage from old version to new
 * @param {Array} history - Old history data
 * @param {number} fromVersion - Version to migrate from
 * @returns {Promise<ArticleData[]>} - Migrated history
 */
async function migrateStorage(history, fromVersion) {
    console.log(`Gripp: Migrating storage from v${fromVersion} to v${STORAGE_VERSION}`);

    // Migration logic for future schema changes
    // Currently just ensures all items have version property
    return history.map(item => ({
        ...item,
        version: STORAGE_VERSION
    }));
}

/**
 * Gets storage usage statistics
 * @returns {Promise<Object>} - Storage stats
 */
export async function getStorageStats() {
    return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
            const history = getHistory();
            resolve({
                bytesInUse,
                itemCount: history.length,
                percentUsed: (bytesInUse / (10 * 1024 * 1024)) * 100 // 10MB limit
            });
        });
    });
}
