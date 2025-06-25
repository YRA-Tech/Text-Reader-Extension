document.addEventListener('DOMContentLoaded', function() {
  const stopButton = document.getElementById('stopButton');
  const status = document.getElementById('status');
  
  // Handle stop button click
  stopButton.addEventListener('click', function() {
    // Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        // Send message to content script to stop reading
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stopReading' }, function(response) {
          if (chrome.runtime.lastError) {
            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          } else if (response && response.success) {
            showStatus('Reading stopped', 'success');
          } else {
            showStatus('No active reading to stop', 'error');
          }
        });
      }
    });
  });
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }
});