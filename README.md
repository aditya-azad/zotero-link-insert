# Zotero Link Insert

A Chrome extension that lets you quickly insert PDF links from your local Zotero library into any text box on the web using `@[` syntax.

## Setup

### 1. Enable Zotero's Local API

1. Open Zotero on your computer
2. Go to **Settings → Advanced**
3. Check **"Allow other applications on this computer to communicate with Zotero"**
4. Open **Config Editor** (at the bottom of the Advanced settings)
5. Search for `extensions.zotero.httpServer.localAPI.enabled`
6. Set it to **`true`** (double-click to toggle)
7. Restart Zotero

### 2. Install the Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this project folder
5. The extension icon should appear in your toolbar

### 3. Verify Connection

Click the extension icon — it should show **"Connected — X papers loaded"**. If you see an error, make sure Zotero is running and the local API is enabled (see step 1).

## Usage

Type **`@[`** in any text box on any webpage to trigger the search dropdown.

- Continue typing to search by **title**, **author**, or **year**
- Use **↑ / ↓** arrow keys to navigate results
- Press **Enter** or **Tab** to insert the PDF link
- Press **Esc** to dismiss

The inserted link is resolved in this order:
- arXiv abstract URLs are converted to direct PDF links (e.g. `arxiv.org/pdf/...`)
- Direct `.pdf` URLs are used as-is
- DOI links (`doi.org/...`) are used as fallback
- Any other URL attached to the paper

## Refreshing the Library

Click the extension icon and press **Refresh Library Cache** to reload papers from Zotero. The cache auto-refreshes every 5 minutes.

## Requirements

- [Zotero 7](https://www.zotero.org/) running locally
- Google Chrome or Chromium-based browser
