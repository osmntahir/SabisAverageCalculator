// popup.js

// Eklenti toggle işlevi
document.getElementById('extensionToggle').addEventListener('change', function (e) {
  const isEnabled = e.target.checked;

  chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
    const statusLabel = document.getElementById('extensionStatus');
    const infoText = document.getElementById('infoText');

    if (isEnabled) {
      statusLabel.textContent = 'Eklenti Aktif';
      infoText.innerHTML = '<i class="fas fa-check-circle" style="color: #38a169; margin-right: 5px;"></i>Sabis OBS sayfasında not ortalamanız otomatik hesaplanacak.';
    } else {
      statusLabel.textContent = 'Eklenti Pasif';
      infoText.innerHTML = '<i class="fas fa-info-circle" style="color: #667eea; margin-right: 5px;"></i>Eklenti şu anda pasif. Aktif etmek için yukarıdaki düğmeyi kullanın.';
    }

    // Sayfayı yenile
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});

// Sayfa yüklendiğinde durumu kontrol et
chrome.storage.local.get('extensionEnabled', function (data) {
  const toggle = document.getElementById('extensionToggle');
  const statusLabel = document.getElementById('extensionStatus');
  const infoText = document.getElementById('infoText');

  // İlk kez kullanım - varsayılan olarak aktif
  if (data.extensionEnabled === undefined) {
    toggle.checked = true;
    chrome.storage.local.set({ extensionEnabled: true });
    statusLabel.textContent = 'Eklenti Aktif';
    infoText.innerHTML = '<i class="fas fa-check-circle" style="color: #38a169; margin-right: 5px;"></i>Sabis OBS sayfasında not ortalamanız otomatik hesaplanacak.';
  } else {
    toggle.checked = data.extensionEnabled;
    if (data.extensionEnabled) {
      statusLabel.textContent = 'Eklenti Aktif';
      infoText.innerHTML = '<i class="fas fa-check-circle" style="color: #38a169; margin-right: 5px;"></i>Sabis OBS sayfasında not ortalamanız otomatik hesaplanacak.';
    } else {
      statusLabel.textContent = 'Eklenti Pasif';
      infoText.innerHTML = '<i class="fas fa-info-circle" style="color: #667eea; margin-right: 5px;"></i>Eklenti şu anda pasif. Aktif etmek için yukarıdaki düğmeyi kullanın.';
    }
  }
});

// Buy Me Coffee button functionality
document.addEventListener('DOMContentLoaded', function () {
  const coffeeBtn = document.getElementById('coffeeBtn');
  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', function (e) {
      e.preventDefault();
  // Buy Me Coffee link
  chrome.tabs.create({ url: 'https://www.buymeacoffee.com/osmntahir' });
    });
  }
});
