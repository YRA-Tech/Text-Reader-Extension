(experimental)
# Text Reader Chrome Extension

A Chrome extension that reads text aloud using the Web Speech API. It supports reading text under the mouse cursor on hover and reading from a specific point to the end of the page via right-click context menu.

## Features

- **Hover Reading**: Automatically reads text under your mouse cursor after a short delay
- **Right-click Reading**: Right-click anywhere on a page to read from that point to the end
- **iframe Support**: Works with content inside iframes
- **Keyboard Control**: Press Escape to stop reading at any time
- **Multiple Element Support**: Works with regular text, form inputs, images (alt text), and links

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the folder containing these extension files
4. The extension should now appear in your extensions list

## Usage

### Hover Reading
- Simply hover your mouse over any text on a webpage
- After a brief delay (500ms), the text will be read aloud
- Move your mouse to different text to read different content

### Right-click Reading
- Right-click anywhere on a webpage
- Select "Read from here to end of page" from the context menu
- The extension will read all text from that point to the bottom of the page

### Stop Reading
- Press the **Escape** key to stop reading immediately
- Right-click and select "Stop reading" from the context menu
- Click the extension icon and use the "Stop Reading" button in the popup

## Files

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main functionality for text detection and speech synthesis
- `background.js` - Context menu management and message handling
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality

## Permissions

The extension requires the following permissions:
- `activeTab` - To interact with the current webpage
- `contextMenus` - To add right-click menu options
- `scripting` - To inject the content script
- `<all_urls>` - To work on all websites
- `all_frames: true` - To work inside iframes

## Browser Support

This extension uses the Web Speech API, which is supported in:
- Chrome (recommended)
- Edge
- Safari (limited support)
- Firefox (limited support)

## Troubleshooting

- If speech doesn't work, ensure your system has text-to-speech capabilities enabled
- Check that your browser supports the Web Speech API
- Make sure the extension has permission to run on the current website
- Verify that your system volume is turned up and not muted
