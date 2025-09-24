// popup.js

// Eklenti toggle işlevi
document.getElementById('extensionToggle').addEventListener('change', function (e) {
  const isEnabled = e.target.checked;

  // Chrome storage API kullanarak veri saklama
  chrome.storage.sync.set({ extensionEnabled: isEnabled }, () => {
    console.log('Extension durumu kaydedildi:', isEnabled);
    updateUI(isEnabled);
  });
});

// UI güncelleme fonksiyonu
function updateUI(isEnabled) {
  const statusLabel = document.getElementById('extensionStatus');
  const infoText = document.getElementById('infoText');

  if (isEnabled) {
    statusLabel.textContent = 'Eklenti Aktif';
    infoText.innerHTML = '<i class="fas fa-check-circle" style="color: #38a169; margin-right: 5px;"></i>Sabis OBS sayfasında not ortalamanız otomatik hesaplanacak.';
  } else {
    statusLabel.textContent = 'Eklenti Pasif';
    infoText.innerHTML = '<i class="fas fa-info-circle" style="color: #667eea; margin-right: 5px;"></i>Eklenti şu anda pasif. Aktif etmek için yukarıdaki düğmeyi kullanın.<br><small style="color: #999;">Sayfayı yenileyerek değişiklikleri görebilirsiniz.</small>';
  }
}

// Buy Me Coffee button functionality
document.addEventListener('DOMContentLoaded', function () {
  const coffeeBtn = document.getElementById('coffeeBtn');
  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      // Buy Me Coffee link - yeni pencerede açma
      window.open('https://www.buymeacoffee.com/osmntahir', '_blank');
    });
  }
  
  // Extension durumu kontrolü
  chrome.storage.sync.get('extensionEnabled', function(data) {
    const toggle = document.getElementById('extensionToggle');
    
    // İlk kez kullanım - varsayılan olarak aktif
    let isEnabled = data.extensionEnabled;
    
    if (isEnabled === undefined) {
      isEnabled = true;
      chrome.storage.sync.set({ extensionEnabled: true });
    }
    
    toggle.checked = isEnabled;
    updateUI(isEnabled);
  });
});
