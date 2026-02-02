# Changelog

All notable changes to Gripp extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-02

### Added
- **Word Count Badges** - Display word count on each history item
  - Green badge for articles (long-form content)
  - Blue badge for regular tweets
  - Automatic content type detection
- **Dynamic Separators** - Responsive full-width separator lines
  - Replaces static 40-character lines
  - Adapts to any screen size
  - Smooth gradient edges
- **Media Count Display** - Shows number of images and videos
- **Content Type Detection** - Automatically classifies articles vs tweets
  - Based on presence of headings or word count >300

### Changed
- **Badge Styling** - Switched from gradients to subtle, professional colors
  - Articles: Light green background `#d4edda`
  - Tweets: Light blue background `#d1ecf1`
  - Removed "AI-looking" purple gradients
- **Separator Format** - Changed from `────────...` to `---`
  - Old static separators still render correctly (backward compatible)
- **Word Counting Algorithm** - Improved accuracy
  - Now uses regex-based word boundary detection
  - Matches Microsoft Word, Google Docs, and online counters
  - Properly handles contractions, punctuation, hashtags
- **Storage Schema** - Added new fields:
  - `wordCount`: Number of words in content
  - `contentType`: 'article' or 'tweet'

### Fixed
- Word count accuracy (was counting punctuation and special characters)
- Separator rendering - now processes on initial display
- Screen size responsiveness for separators

## [1.1.0] - 2026-02-02

### Added
- **Shared Utility Modules** in `src/shared/`:
  - `formatters.js` - Text and time formatting utilities
  - `theme.js` - Theme management (load, toggle, icons)
  - `storage.js` - Storage abstraction with schema versioning
  - `constants.js` - Centralized constants and magic numbers
  - `error-handler.js` - Comprehensive error handling system
- **Storage Schema Versioning** (v2)
  - Migration support for future updates
  - Retry logic for failed operations
- **Error Handling Infrastructure**
  - Custom `GrippError` class
  - Error boundaries with `withErrorBoundary` wrapper
  - Local error logging
  - Safe DOM and storage operations

### Changed
- **Logo Assets Optimization**
  - Reduced from 170KB JPEG to 11KB total PNGs (94% reduction)
  - Created three optimized sizes: 16px, 48px, 128px
  - Updated manifest to use new asset paths
- **Code Organization**
  - Extracted duplicated functions to shared modules
  - Improved code maintainability

### Documentation
- Created comprehensive README with architecture details
- Added development guidelines
- Documented privacy policies

## [1.0.0] - 2026-01-19

### Added
- Initial release of Gripp extension
- **Core Features**:
  - One-click X article copying
  - Complete content extraction (headings, paragraphs, lists, media)
  - Right-click context menu integration
  - Customizable keyboard shortcuts (default: Ctrl+Shift+G)
  - History management (50 items)
  - Search functionality
  - Dark/Light theme toggle
- **Content Extraction**:
  - X/Twitter article support
  - Long-form post detection
  - Image and video detection
  - Quote tweet handling
  - Thread detection
- **UI**:
  - Popup interface for quick access
  - Full-page history view
  - Settings panel
  - Expandable history items
- **Privacy**:
  - 100% local processing
  - No external servers
  - No analytics or tracking
  - No network requests

### Technical
- Chrome Manifest V3
- Chrome storage API integration
- Context menu API
- Clipboard API

---

## Release Notes

### v2.0.0 Highlights
This is a major visual update focusing on user experience:
- At-a-glance content information with word count badges
- Professional color coding for quick content type recognition
- Improved text rendering with responsive separators
- More accurate word counting for researchers and writers

### Migration Notes
- **v1.x → v2.0**: Automatic schema migration
- Old history items will work but won't have word counts
- New copies will include all new features
- No action required from users

---

## Upcoming Features
See our [Roadmap](README.md#roadmap) for planned features:
- Export to Markdown/JSON
- IndexedDB for unlimited history
- Advanced search and filtering
- Batch operations
- Auto-tagging with ML

---

**For full details, see the [README](README.md)**
