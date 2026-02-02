// src/shared/theme.js
// Shared theme management utilities

/**
 * Loads the current theme from storage
 * @returns {Promise<string>} - Theme name ('light' or 'dark')
 */
export async function loadTheme() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({ theme: 'dark' }, (data) => {
            resolve(data.theme);
        });
    });
}

/**
 * Applies theme to the document body
 * @param {string} theme - Theme name ('light' or 'dark')
 */
export function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

/**
 * Updates theme icons (sun/moon) based on current theme
 * @param {string} theme - Theme name ('light' or 'dark')
 */
export function updateThemeIcons(theme) {
    const darkIcon = document.getElementById('theme-icon-dark');
    const lightIcon = document.getElementById('theme-icon-light');

    if (!darkIcon || !lightIcon) return;

    if (theme === 'light') {
        // Light mode: show moon icon (to switch to dark)
        darkIcon.style.display = 'block';
        lightIcon.style.display = 'none';
    } else {
        // Dark mode: show sun icon (to switch to light)
        darkIcon.style.display = 'none';
        lightIcon.style.display = 'block';
    }
}

/**
 * Toggles between light and dark theme
 * @returns {Promise<string>} - New theme name
 */
export async function toggleTheme() {
    const currentTheme = await loadTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    applyTheme(newTheme);
    updateThemeIcons(newTheme);

    return new Promise((resolve) => {
        chrome.storage.sync.set({ theme: newTheme }, () => {
            resolve(newTheme);
        });
    });
}

/**
 * Initializes theme on page load
 * @returns {Promise<string>} - Current theme
 */
export async function initTheme() {
    const theme = await loadTheme();
    applyTheme(theme);
    updateThemeIcons(theme);
    return theme;
}
