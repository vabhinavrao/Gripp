// popup.js

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    loadShortcutSettings();
    loadTheme();
    loadDeleteConfirmPreference();

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Expand to full page
    document.getElementById('expand-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
    });

    // Clear history button
    document.getElementById('clear-history').addEventListener('click', () => {
        if (confirm("Clear all history?")) {
            chrome.storage.local.set({ history: [] }, () => {
                loadHistory();
            });
        }
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('history-view').classList.remove('active');
        document.getElementById('settings-view').classList.add('active');
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('settings-view').classList.remove('active');
        document.getElementById('history-view').classList.add('active');
    });

    // Save shortcut
    document.getElementById('save-shortcut').addEventListener('click', saveShortcut);
});

function loadHistory() {
    const list = document.getElementById('history-list');

    chrome.storage.local.get({ history: [] }, (data) => {
        const history = data.history;
        list.innerHTML = '';

        if (history.length === 0) {
            list.innerHTML = '<div class="empty-state">No articles copied yet.<br><br>Go to X, right-click an article,<br>and select "Copy full post with Gripp"</div>';
            return;
        }

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.setAttribute('data-full-text', item.fullText || item.preview);

            const date = new Date(item.timestamp);
            const timeStr = formatTime(date);

            // Get first 4 lines of actual content
            const contentLines = (item.fullText || item.preview).split('\n').filter(l => l.trim());
            const displayText = contentLines.slice(0, 4).join('\n');
            const hasMoreContent = contentLines.length > 4;

            // Build media badge if there's media
            let mediaBadge = '';
            if (item.mediaCount && item.mediaCount > 0) {
                let parts = [];
                if (item.media && item.media.images > 0) parts.push(`${item.media.images} img`);
                if (item.media && item.media.videos > 0) parts.push(`${item.media.videos} vid`);
                mediaBadge = `<span class="media-badge">📷 ${parts.length > 0 ? parts.join(', ') : item.mediaCount + ' media'}</span>`;
            }

            // Build word count badge with color coding
            let wordCountBadge = '';
            if (item.wordCount) {
                const contentType = item.contentType || 'tweet'; // Default to tweet if not set
                const badgeClass = contentType === 'article' ? 'word-badge-article' : 'word-badge-tweet';
                wordCountBadge = `<span class="word-badge ${badgeClass}">${item.wordCount} words</span>`;
            }

            // Link text based on content type
            const contentType = item.contentType || 'tweet';
            const linkText = contentType === 'article' ? 'View Article' : 'View Tweet';


            card.innerHTML = `
                <div class="card-header">
                    <span class="timestamp">${timeStr}</span>
                    <div class="header-right">
                        <div class="badges">
                            ${wordCountBadge}
                            ${mediaBadge}
                        </div>
                        <button class="delete-btn" title="Delete this item">×</button>
                    </div>
                </div>
                <div class="preview-text" data-full-content="${escapeHtml(item.fullText || item.preview)}" data-preview="${escapeHtml(displayText)}">${formatTextWithSeparators(displayText)}</div>
                ${hasMoreContent ? '<div class="expand-btn">▼ Click to expand</div>' : ''}
                <div class="card-footer">
                    <a href="${escapeHtml(item.url || '#')}" target="_blank" class="view-link" onclick="event.stopPropagation();">${linkText}</a>
                </div>
            `;

            const expandBtn = card.querySelector('.expand-btn');
            const previewText = card.querySelector('.preview-text');
            const deleteBtn = card.querySelector('.delete-btn');

            // Delete button
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDeleteConfirmation(() => {
                        deleteHistoryItem(item.id || item.timestamp);
                    });
                });
            }

            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = previewText.classList.toggle('expanded');
                    if (isExpanded) {
                        previewText.innerHTML = formatTextWithSeparators(previewText.getAttribute('data-full-content'));
                        expandBtn.textContent = '▲ Click to collapse';
                    } else {
                        previewText.innerHTML = formatTextWithSeparators(previewText.getAttribute('data-preview'));
                        expandBtn.textContent = '▼ Click to expand';
                    }
                });
            }

            // Click on card (but not expand btn or link) to copy
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('expand-btn') && e.target.tagName !== 'A') {
                    const fullText = card.getAttribute('data-full-text');
                    copyToClipboard(fullText);
                }
            });

            list.appendChild(card);
        });
    });
}

// Delete confirmation preference
let skipDeleteConfirm = false;

function loadDeleteConfirmPreference() {
    chrome.storage.sync.get({ skipDeleteConfirm: false }, (data) => {
        skipDeleteConfirm = data.skipDeleteConfirm;
    });
}

function showDeleteConfirmation(onConfirm) {
    // If user previously checked "don't ask again", just confirm
    if (skipDeleteConfirm) {
        onConfirm();
        return;
    }

    // Create custom modal
    const modal = document.createElement('div');
    modal.id = 'delete-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Delete this item?</h3>
                <p>This action cannot be undone.</p>
                <label class="checkbox-label">
                    <input type="checkbox" id="dont-ask-checkbox">
                    <span>Don't ask me again</span>
                </label>
                <div class="modal-actions">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-delete">Delete</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const checkbox = modal.querySelector('#dont-ask-checkbox');
    const cancelBtn = modal.querySelector('.btn-cancel');
    const deleteBtn = modal.querySelector('.btn-delete');

    cancelBtn.onclick = () => {
        modal.remove();
    };

    deleteBtn.onclick = () => {
        if (checkbox.checked) {
            skipDeleteConfirm = true;
            chrome.storage.sync.set({ skipDeleteConfirm: true });
        }
        modal.remove();
        onConfirm();
    };

    // Close on overlay click
    modal.querySelector('.modal-overlay').onclick = (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            modal.remove();
        }
    };
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

function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;

    // For older than 24h, show full date/time
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
    });
}

function loadShortcutSettings() {
    chrome.storage.sync.get({ shortcut: { ctrl: true, shift: true, alt: false, key: 'g' } }, (data) => {
        const s = data.shortcut;
        document.getElementById('sc-ctrl').checked = s.ctrl;
        document.getElementById('sc-shift').checked = s.shift;
        document.getElementById('sc-alt').checked = s.alt || false;
        document.getElementById('sc-key').value = s.key.toUpperCase();
        updateShortcutDisplay(s);
    });
}

function updateShortcutDisplay(s) {
    let parts = [];
    if (s.ctrl) parts.push('Ctrl');
    if (s.shift) parts.push('Shift');
    if (s.alt) parts.push('Alt');
    parts.push(s.key.toUpperCase());
    document.getElementById('current-shortcut-display').textContent = parts.join('+');
}

function saveShortcut() {
    const shortcut = {
        ctrl: document.getElementById('sc-ctrl').checked,
        shift: document.getElementById('sc-shift').checked,
        alt: document.getElementById('sc-alt').checked,
        key: document.getElementById('sc-key').value.toLowerCase() || 'g'
    };

    chrome.storage.sync.set({ shortcut: shortcut }, () => {
        updateShortcutDisplay(shortcut);
        // Show feedback
        const btn = document.getElementById('save-shortcut');
        btn.textContent = 'Saved!';
        btn.style.background = '#00ba7c';
        setTimeout(() => {
            btn.textContent = 'Save Shortcut';
            btn.style.background = '';
        }, 1500);
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
    // Create temporary feedback
    const existing = document.getElementById('copy-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.id = 'copy-feedback';
    feedback.textContent = '✓ Copied to clipboard!';
    feedback.style.position = 'fixed';
    feedback.style.bottom = '20px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = '#00ba7c';
    feedback.style.color = '#fff';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '8px';
    feedback.style.fontSize = '13px';
    feedback.style.fontWeight = '500';
    feedback.style.zIndex = '10000';
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
 * Process text to replace --- with full-width separator
 * @param {string} text - Text to process
 * @returns {string} - Processed text
 */
function processTextForDisplay(text) {
    return text; // Keep original text for data attributes
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
