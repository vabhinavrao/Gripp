// history.js

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    loadTheme();

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Close button
    document.getElementById('close-btn').addEventListener('click', () => {
        window.close();
    });

    document.getElementById('clear-all').addEventListener('click', () => {
        if (confirm("Clear all history?")) {
            chrome.storage.local.set({ history: [] }, () => {
                loadHistory();
            });
        }
    });
});

function loadHistory() {
    const container = document.getElementById('history-container');

    chrome.storage.local.get({ history: [] }, (data) => {
        const history = data.history;
        container.innerHTML = '';

        if (history.length === 0) {
            container.innerHTML = '<div class="empty-state">No clips yet.<br><br>Go to X, right-click a post, and select "Copy full post with Gripp"</div>';
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.setAttribute('data-full-text', item.fullText || item.preview);

            const date = new Date(item.timestamp);
            const relativeTime = formatRelativeTime(date);
            const fullTime = formatFullTime(date);

            // Show actual tweet content (first 4 lines)
            const contentLines = (item.fullText || item.preview).split('\n').filter(l => l.trim());
            const displayText = contentLines.slice(0, 4).join('\n');
            const hasMoreContent = contentLines.length > 4;

            // Build media badge if there's media
            let mediaBadge = '';
            if (item.mediaCount && item.mediaCount > 0) {
                let parts = [];
                if (item.media && item.media.images > 0) parts.push(`${item.media.images} image${item.media.images === 1 ? '' : 's'}`);
                if (item.media && item.media.videos > 0) parts.push(`${item.media.videos} video${item.media.videos === 1 ? '' : 's'}`);
                mediaBadge = `<span class="media-badge">📷 ${parts.length > 0 ? parts.join(', ') : item.mediaCount + ' media'}</span>`;
            }

            // Build word count badge with color coding
            let wordCountBadge = '';
            if (item.wordCount) {
                const contentType = item.contentType || 'tweet';
                const badgeClass = contentType === 'article' ? 'word-badge-article' : 'word-badge-tweet';
                wordCountBadge = `<span class="word-badge ${badgeClass}">${item.wordCount} words</span>`;
            }

            div.innerHTML = `
                <div class="item-header">
                    <div>
                        <div class="timestamp">${relativeTime}</div>
                        <div class="full-timestamp">${fullTime}</div>
                    </div>
                    <div class="badges">
                        ${wordCountBadge}
                        ${mediaBadge}
                    </div>
                </div>
                <div class="item-text" data-full-content="${escapeHtml(item.fullText || item.preview)}" data-preview="${escapeHtml(displayText)}">${formatTextWithSeparators(displayText)}</div>
                ${hasMoreContent ? '<div class="expand-btn">▼ Click to expand</div>' : ''}
                <div class="item-footer">
                    <a href="${item.url}" target="_blank" class="view-link" onclick="event.stopPropagation();">View Tweet →</a>
                </div>
            `;

            const expandBtn = div.querySelector('.expand-btn');
            const itemText = div.querySelector('.item-text');

            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = itemText.classList.toggle('expanded');
                    if (isExpanded) {
                        itemText.innerHTML = formatTextWithSeparators(itemText.getAttribute('data-full-content'));
                        expandBtn.textContent = '▲ Click to collapse';
                    } else {
                        itemText.innerHTML = formatTextWithSeparators(itemText.getAttribute('data-preview'));
                        expandBtn.textContent = '▼ Click to expand';
                    }
                });
            }

            // Click on card (but not expand btn or link) to copy
            div.addEventListener('click', (e) => {
                if (!e.target.classList.contains('expand-btn') && e.target.tagName !== 'A') {
                    const fullText = div.getAttribute('data-full-text');
                    copyToClipboard(fullText);
                }
            });

            container.appendChild(div);
        });
    });
}

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return '1 day ago';
    if (diffDay < 7) return `${diffDay} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deleteHistoryItem(itemId) {
    chrome.storage.local.get({ history: [] }, (data) => {
        const history = data.history;
        const filteredHistory = history.filter(item =>
            (item.id || item.timestamp) !== itemId
        );
        chrome.storage.local.set({ history: filteredHistory }, () => {
            loadHistory(); // Reload the list
        });
    });
}

function formatFullTime(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function loadTheme() {
    chrome.storage.sync.get({ theme: 'dark' }, (data) => {
        if (data.theme === 'light') {
            document.body.classList.add('light-theme');
            // Light mode: show moon icon (to switch to dark)
            document.getElementById('theme-icon-dark').style.display = 'block';
            document.getElementById('theme-icon-light').style.display = 'none';
        } else {
            // Dark mode: show sun icon (to switch to light)
            document.getElementById('theme-icon-dark').style.display = 'none';
            document.getElementById('theme-icon-light').style.display = 'block';
        }
    });
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const newTheme = isLight ? 'light' : 'dark';

    // Light mode: show moon (to switch to dark). Dark mode: show sun (to switch to light)
    document.getElementById('theme-icon-dark').style.display = isLight ? 'block' : 'none';
    document.getElementById('theme-icon-light').style.display = isLight ? 'none' : 'block';

    chrome.storage.sync.set({ theme: newTheme });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback();
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

function showCopyFeedback() {
    const existing = document.getElementById('copy-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.id = 'copy-feedback';
    feedback.textContent = '✓ Copied to clipboard!';
    feedback.style.position = 'fixed';
    feedback.style.bottom = '30px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = '#00ba7c';
    feedback.style.color = '#fff';
    feedback.style.padding = '12px 24px';
    feedback.style.borderRadius = '8px';
    feedback.style.fontSize = '14px';
    feedback.style.fontWeight = '500';
    feedback.style.zIndex = '10000';
    feedback.style.boxShadow = '0 4px 20px rgba(0, 186, 124, 0.3)';
    feedback.style.opacity = '0';
    feedback.style.transition = 'opacity 0.2s';

    document.body.appendChild(feedback);

    setTimeout(() => feedback.style.opacity = '1', 10);
    setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => feedback.remove(), 200);
    }, 2000);
}

/**
 * Format text with dynamic separators for display
 * @param {string} text - Text to format
 * @returns {string} - HTML with formatted separators
 */
function formatTextWithSeparators(text) {
    if (!text) return '';

    // Replace --- with a styled separator div
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
        const trimmed = line.trim();

        // Check for new separator format (---)
        if (trimmed === '---') {
            return '<div class="dynamic-separator"></div>';
        }

        // Check for old separator format (10+ consecutive ─ characters)
        if (/^─{10,}$/.test(trimmed)) {
            return '<div class="dynamic-separator"></div>';
        }

        return escapeHtml(line);
    });

    return formattedLines.join('\n');
}
