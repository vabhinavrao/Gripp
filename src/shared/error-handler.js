// src/shared/error-handler.js
// Centralized error handling and logging

/**
 * Custom error class for Gripp extension
 */
export class GrippError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'GrippError';
        this.context = context;
        this.timestamp = Date.now();
    }
}

/**
 * Error types for better categorization
 */
export const ERROR_TYPES = {
    EXTRACTION_FAILED: 'ExtractionFailed',
    CLIPBOARD_FAILED: 'ClipboardFailed',
    STORAGE_FAILED: 'StorageFailed',
    NETWORK_ERROR: 'NetworkError',
    DOM_NOT_FOUND: 'DOMNotFound',
    INVALID_DATA: 'InvalidData'
};

/**
 * Wraps a function with error boundary
 * @param {Function} fn - Function to wrap
 * @param {Function} fallback - Fallback function if error occurs
 * @returns {Function} - Wrapped function
 */
export function withErrorBoundary(fn, fallback) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`[Gripp Error]`, {
                function: fn.name,
                error: error.message,
                stack: error.stack,
                context: error.context || {}
            });

            // Track error (could add analytics here)
            trackError(error);

            // Execute fallback
            if (fallback) {
                return fallback(error);
            }

            return null;
        }
    };
}

/**
 * Tracks errors locally for debugging
 * @param {Error} error - Error to track
 */
function trackError(error) {
    chrome.storage.local.get(['errorLog'], (data) => {
        const errorLog = data.errorLog || [];

        errorLog.push({
            message: error.message,
            type: error.name,
            context: error.context || {},
            timestamp: Date.now()
        });

        // Keep only last 20 errors
        const recentErrors = errorLog.slice(-20);

        chrome.storage.local.set({ errorLog: recentErrors });
    });
}

/**
 * Gets recent errors for debugging
 * @returns {Promise<Array>} - Recent errors
 */
export async function getRecentErrors() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['errorLog'], (data) => {
            resolve(data.errorLog || []);
        });
    });
}

/**
 * Clears error log
 * @returns {Promise<void>}
 */
export async function clearErrorLog() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ errorLog: [] }, resolve);
    });
}

/**
 * Safe DOM query with error handling
 * @param {Element} parent - Parent element
 * @param {string} selector - CSS selector
 * @returns {Element|null} - Found element or null
 */
export function safeQuerySelector(parent, selector) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        console.warn(`[Gripp] Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Safe storage operation with retry
 * @param {Function} operation - Storage operation
 * @param {number} retries - Number of retries
 * @returns {Promise<any>} - Operation result
 */
export async function safeStorageOperation(operation, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`[Gripp] Storage operation failed (attempt ${i + 1}/${retries})`, error);

            if (i === retries - 1) {
                throw new GrippError('Storage operation failed after retries', {
                    originalError: error.message,
                    attempts: retries
                });
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        }
    }
}
