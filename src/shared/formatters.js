// src/shared/formatters.js
// Shared formatting utilities used across popup, history, and content scripts

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Formats a timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} - Formatted relative time
 */
export function formatRelativeTime(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return '1 day ago';
    if (diffDay < 7) return `${diffDay} days ago`;

    return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Formats a date as full timestamp
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} - Formatted full date
 */
export function formatFullTime(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formats media count for display
 * @param {Object} media - Media object with images and videos counts
 * @returns {string} - Formatted media string (e.g., "5 images, 2 videos")
 */
export function formatMediaCount(media) {
    if (!media || (media.images === 0 && media.videos === 0)) {
        return '';
    }

    const parts = [];
    if (media.images > 0) {
        parts.push(`${media.images} image${media.images === 1 ? '' : 's'}`);
    }
    if (media.videos > 0) {
        parts.push(`${media.videos} video${media.videos === 1 ? '' : 's'}`);
    }

    return parts.join(', ');
}
