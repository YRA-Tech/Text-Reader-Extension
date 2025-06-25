// Extension installed handler
chrome.runtime.onInstalled.addListener(() => {
  console.log('Text Reader Extension installed');
});

// Handle extension icon click (optional - for debugging)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});