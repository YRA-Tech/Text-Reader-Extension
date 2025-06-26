let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isReading = false;
let hoverTimeout = null;
let readingQueue = [];
let currentReadingIndex = 0;
let isMainFrame = window === window.top;
let isLongReading = false; // Track if we're doing a long read (right-click)
let lastHoverText = ''; // Track last hovered text to prevent repeats

// Configuration
const HOVER_DELAY = 300; // milliseconds before reading on hover
const STOP_ON_MOUSE_MOVE = false; // Changed to false to reduce interruptions

// Initialize speech synthesis
function initializeSpeech() {
  if (!speechSynthesis) {
    console.error('Speech synthesis not supported');
    return false;
  }
  return true;
}

// Stop current speech
function stopSpeech() {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  if (currentUtterance) {
    currentUtterance = null;
  }
  isReading = false;
  isLongReading = false;
  readingQueue = [];
  currentReadingIndex = 0;
  lastHoverText = '';
  
  // Clear any pending hover timeout
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  
  // Notify all frames to stop reading
  if (isMainFrame) {
    broadcastToAllFrames({ action: 'stopReading' });
  }
}

// Speak text using Web Speech API
function speakText(text, isLongRead = false) {
  if (!text || text.trim().length === 0) return;
  
  // Don't interrupt long reading with hover
  if (isLongReading && !isLongRead) {
    return;
  }
  
  // Only stop previous speech if we're not in the middle of a queue
  if (readingQueue.length === 0 || isLongRead) {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
  }
  
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 1.0;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;
  
  currentUtterance.onstart = () => {
    isReading = true;
    if (isLongRead) {
      isLongReading = true;
    }
  };
  
  currentUtterance.onend = () => {
    isReading = false;
    currentUtterance = null;
    
    // Check if there are more items in the reading queue
    processNextInQueue();
  };
  
  currentUtterance.onerror = (event) => {
    // Only log errors that aren't interruptions from our own code
    if (event.error !== 'interrupted' || readingQueue.length === 0) {
      console.error('Speech synthesis error:', event.error);
    }
    isReading = false;
    currentUtterance = null;
    
    // Continue with queue if available
    if (readingQueue.length > 0) {
      processNextInQueue();
    } else {
      isLongReading = false;
    }
  };
  
  try {
    speechSynthesis.speak(currentUtterance);
  } catch (error) {
    console.warn('Speech synthesis blocked:', error.message);
  }
}

// Process next item in reading queue
function processNextInQueue() {
  currentReadingIndex++;
  if (currentReadingIndex < readingQueue.length) {
    const nextItem = readingQueue[currentReadingIndex];
    speakText(nextItem.text, true); // Mark as long read
  } else {
    // Queue finished, reset
    readingQueue = [];
    currentReadingIndex = 0;
    isLongReading = false;
  }
}

// Add text to reading queue
function queueTextForReading(textArray) {
  readingQueue = textArray.map(item => ({ text: item }));
  currentReadingIndex = 0;
  isLongReading = true;
  
  if (readingQueue.length > 0) {
    speakText(readingQueue[0].text, true); // Mark as long read
  }
}

// Get text content from element, handling various element types
function getElementText(element) {
  if (!element) return '';
  
  // Handle input elements
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return element.value || element.placeholder || '';
  }
  
  // Handle images with alt text
  if (element.tagName === 'IMG') {
    return element.alt || element.title || '';
  }
  
  // Handle links
  if (element.tagName === 'A') {
    return element.textContent || element.title || element.href || '';
  }
  
  // Get text content, fallback to innerText
  return element.textContent || element.innerText || '';
}

// Get text under mouse cursor
function getTextUnderMouse(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return '';
  
  const text = getElementText(element);
  return text.trim();
}

// Get all text from current position to end of page, including iframes
function getTextFromPositionToEnd(startElement) {
  if (!startElement) return '';
  
  // Create a tree walker that includes both text nodes and iframe elements
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        // Accept iframe elements
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
          return NodeFilter.FILTER_ACCEPT;
        }
        // Accept text nodes (but skip script and style)
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let nodes = [];
  let node;
  
  // Collect all nodes in document order
  while (node = walker.nextNode()) {
    nodes.push(node);
  }
  
  // Find the starting position
  let startIndex = -1;
  for (let i = 0; i < nodes.length; i++) {
    const currentNode = nodes[i];
    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.parentElement === startElement || 
          startElement.contains(currentNode)) {
        startIndex = i;
        break;
      }
    }
  }
  
  // If we couldn't find the start position, try to find it by position
  if (startIndex === -1) {
    const startRect = startElement.getBoundingClientRect();
    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNode(currentNode);
        const nodeRect = range.getBoundingClientRect();
        if (nodeRect.top >= startRect.top && nodeRect.left >= startRect.left) {
          startIndex = i;
          break;
        }
      }
    }
  }
  
  if (startIndex === -1) {
    // Fallback to just the element's text
    return getElementText(startElement);
  }
  
  // Process nodes from start position to end
  const textParts = [];
  
  for (let i = startIndex; i < nodes.length; i++) {
    const currentNode = nodes[i];
    
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.tagName === 'IFRAME') {
      // Try to get iframe content
      try {
        const iframeText = getTextFromIframe(currentNode);
        if (iframeText) {
          textParts.push(iframeText);
        }
      } catch (e) {
        // Cross-origin iframe, we'll handle this separately
        console.log('Cross-origin iframe detected, will handle with postMessage');
      }
    }
  }
  
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

// Get text from current frame only
function getTextFromCurrentFrame(startElement) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style elements
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let textNodes = [];
  let node;
  let foundStart = false;
  
  // Find all text nodes
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Find starting position
  for (let i = 0; i < textNodes.length; i++) {
    if (textNodes[i].parentElement === startElement || 
        startElement.contains(textNodes[i])) {
      foundStart = true;
      textNodes = textNodes.slice(i);
      break;
    }
  }
  
  if (!foundStart) {
    // If we can't find the exact start, just use all text from the element
    return getElementText(startElement);
  }
  
  // Combine all text from start position to end of current frame
  return textNodes
    .map(node => node.textContent)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get all iframes that appear after the given element
function getAllIframesAfterElement(startElement) {
  const iframes = Array.from(document.querySelectorAll('iframe'));
  const startRect = startElement.getBoundingClientRect();
  
  return iframes.filter(iframe => {
    const iframeRect = iframe.getBoundingClientRect();
    // Include iframes that appear after the start element (by document order or position)
    return (
      iframeRect.top > startRect.top ||
      (iframeRect.top === startRect.top && iframeRect.left >= startRect.left)
    );
  });
}

// Get text from iframe (same-origin only)
function getTextFromIframe(iframe) {
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    if (!iframeDoc || !iframeDoc.body) return '';
    
    const walker = document.createTreeWalker(
      iframeDoc.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes
      .map(node => node.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    // Cross-origin iframe
    return '';
  }
}

// Mouse move handler for hover reading
function handleMouseMove(event) {
  // Don't interrupt long reading (right-click reading)
  if (isLongReading) {
    return;
  }
  
  // Clear existing timeout
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  
  // Set new timeout for hover reading
  hoverTimeout = setTimeout(() => {
    // Double-check we're not in long reading mode
    if (isLongReading) {
      return;
    }
    
    const text = getTextUnderMouse(event);
    if (text && text.length > 0 && text !== lastHoverText) {
      lastHoverText = text;
      speakText(text, false); // Mark as hover read
    }
  }, HOVER_DELAY);
}

// Right-click handler for reading from cursor to end
function handleContextMenu(event) {
  // Get the clicked element
  const clickedElement = document.elementFromPoint(event.clientX, event.clientY);
  
  if (clickedElement) {
    // Prevent the default context menu
    event.preventDefault();
    
    // Start reading from this position
    handleReadFromCursorToEnd(clickedElement)
      .then(result => {
        if (!result.success) {
          console.error('Failed to read text:', result.error);
        }
      })
      .catch(error => {
        console.error('Error reading text:', error);
      });
  }
}

// Broadcast message to all frames
function broadcastToAllFrames(message) {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    } catch (e) {
      // Cross-origin iframe, can't send message
      console.log('Could not send message to iframe:', e.message);
    }
  }
}

// Handle cross-frame messages
function handleFrameMessage(event) {
  if (event.data && event.data.action) {
    switch (event.data.action) {
      case 'stopReading':
        stopSpeech();
        break;
      case 'getIframeText':
        // Respond with iframe text content
        const text = document.body ? document.body.innerText || document.body.textContent || '' : '';
        event.source.postMessage({
          action: 'iframeTextResponse',
          text: text.trim(),
          frameId: event.data.frameId
        }, '*');
        break;
    }
  }
}

// Get text from cross-origin iframes using postMessage
async function getTextFromCrossOriginIframes(startElement) {
  const iframes = getAllIframesAfterElement(startElement);
  const textPromises = [];
  
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    const frameId = `frame_${i}_${Date.now()}`;
    
    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(''); // Timeout after 2 seconds
      }, 2000);
      
      const messageHandler = (event) => {
        if (event.data && event.data.action === 'iframeTextResponse' && event.data.frameId === frameId) {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          resolve(event.data.text || '');
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      try {
        iframe.contentWindow.postMessage({
          action: 'getIframeText',
          frameId: frameId
        }, '*');
      } catch (e) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        resolve('');
      }
    });
    
    textPromises.push(promise);
  }
  
  const iframeTexts = await Promise.all(textPromises);
  return iframeTexts.filter(text => text.length > 0);
}

// Listen for messages from background script (for popup controls)
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'stopReading') {
    stopSpeech();
    sendResponse({ success: true });
  }
});

// Handle reading from cursor to end with iframe support
async function handleReadFromCursorToEnd(startElement) {
  try {
    // Get text using the new document-order approach
    const textWithIframes = await getTextFromPositionToEndAsync(startElement);
    
    if (textWithIframes && textWithIframes.length > 0) {
      // Check if we have multiple text parts (indicating iframes)
      const textParts = textWithIframes.split(/\[IFRAME_BREAK\]/);
      
      if (textParts.length > 1) {
        // Multiple parts - use queued reading
        const filteredParts = textParts.filter(part => part.trim().length > 0);
        queueTextForReading(filteredParts);
      } else {
        // Single part - speak directly
        speakText(textWithIframes, true); // Mark as long read
      }
      return { success: true, text: textWithIframes.substring(0, 100) + '...' };
    } else {
      return { success: false, error: 'No text found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enhanced version that handles cross-origin iframes
async function getTextFromPositionToEndAsync(startElement) {
  if (!startElement) return '';
  
  // Create a tree walker that includes both text nodes and iframe elements
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        // Accept iframe elements
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
          return NodeFilter.FILTER_ACCEPT;
        }
        // Accept text nodes (but skip script and style)
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let nodes = [];
  let node;
  
  // Collect all nodes in document order
  while (node = walker.nextNode()) {
    nodes.push(node);
  }
  
  // Find the starting position
  let startIndex = -1;
  for (let i = 0; i < nodes.length; i++) {
    const currentNode = nodes[i];
    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.parentElement === startElement || 
          startElement.contains(currentNode)) {
        startIndex = i;
        break;
      }
    }
  }
  
  // If we couldn't find the start position, try to find it by position
  if (startIndex === -1) {
    const startRect = startElement.getBoundingClientRect();
    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNode(currentNode);
        const nodeRect = range.getBoundingClientRect();
        if (nodeRect.top >= startRect.top && nodeRect.left >= startRect.left) {
          startIndex = i;
          break;
        }
      }
    }
  }
  
  if (startIndex === -1) {
    // Fallback to just the element's text
    return getElementText(startElement);
  }
  
  // Process nodes from start position to end
  const textParts = [];
  const iframePromises = [];
  
  for (let i = startIndex; i < nodes.length; i++) {
    const currentNode = nodes[i];
    
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.tagName === 'IFRAME') {
      // Mark iframe position
      const iframeIndex = textParts.length;
      textParts.push('[IFRAME_PLACEHOLDER]');
      
      // Try to get iframe content
      const iframePromise = getIframeTextAsync(currentNode, iframeIndex);
      iframePromises.push(iframePromise);
    }
  }
  
  // Wait for all iframe content
  const iframeResults = await Promise.all(iframePromises);
  
  // Replace placeholders with actual iframe content
  for (const result of iframeResults) {
    if (result.text) {
      textParts[result.index] = result.text;
    } else {
      textParts[result.index] = ''; // Remove placeholder if no content
    }
  }
  
  return textParts.filter(part => part.length > 0).join(' ').replace(/\s+/g, ' ').trim();
}

// Get iframe text with async support for cross-origin
async function getIframeTextAsync(iframe, index) {
  try {
    // Try same-origin first
    const iframeText = getTextFromIframe(iframe);
    if (iframeText) {
      return { index, text: iframeText };
    }
  } catch (e) {
    // Cross-origin iframe, try postMessage
  }
  
  // Try cross-origin approach
  const frameId = `frame_${index}_${Date.now()}`;
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ index, text: '' }); // Timeout after 2 seconds
    }, 2000);
    
    const messageHandler = (event) => {
      if (event.data && event.data.action === 'iframeTextResponse' && event.data.frameId === frameId) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        resolve({ index, text: event.data.text || '' });
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    try {
      iframe.contentWindow.postMessage({
        action: 'getIframeText',
        frameId: frameId
      }, '*');
    } catch (e) {
      clearTimeout(timeout);
      window.removeEventListener('message', messageHandler);
      resolve({ index, text: '' });
    }
  });
}

// Initialize the extension
if (initializeSpeech()) {
  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('contextmenu', handleContextMenu, true);
  
  // Add cross-frame message listener
  window.addEventListener('message', handleFrameMessage, true);
  
  // Add keyboard shortcut to stop reading (Escape key)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isReading) {
      stopSpeech();
      event.preventDefault();
    }
  });
  
  console.log('Text Reader Extension loaded successfully in', isMainFrame ? 'main frame' : 'iframe');
} else {
  console.error('Text Reader Extension failed to initialize');
}
