// popup.js

document.getElementById('extensionToggle').addEventListener('change', function (e) {
    const isEnabled = e.target.checked;
  
    
    chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
      
      const statusLabel = document.getElementById('extensionStatus');
      statusLabel.textContent = isEnabled ? 'Eklenti Aktif' : 'Eklenti Pasif';
  
      
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  });
  

  chrome.storage.local.get('extensionEnabled', function (data) {
    const toggle = document.getElementById('extensionToggle');
    const statusLabel = document.getElementById('extensionStatus');
  
   
    if (data.extensionEnabled === undefined) {
      toggle.checked = true;
      chrome.storage.local.set({ extensionEnabled: true });
      statusLabel.textContent = 'Eklenti Aktif';
    } else {
      toggle.checked = data.extensionEnabled;
      statusLabel.textContent = data.extensionEnabled ? 'Eklenti Aktif' : 'Eklenti Pasif';
    }
  });
  