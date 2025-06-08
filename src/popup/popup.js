// popup.js – modern versiyon
document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('extToggle');
  const status = document.getElementById('status');

  // durum yükle
  const { extensionEnabled = true } =
    await chrome.storage.local.get('extensionEnabled');
  toggle.checked = extensionEnabled;
  status.textContent = extensionEnabled ? 'Eklenti Aktif' : 'Eklenti Pasif';

  // değişiklik
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await chrome.storage.local.set({ extensionEnabled: enabled });
    status.textContent = enabled ? 'Eklenti Aktif' : 'Eklenti Pasif';

    // açık sekmeyi yenile (isteğe bağlı)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab && chrome.tabs.reload(tab.id);
  });
});
