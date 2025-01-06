// background.js (Manifest v3'te service_worker olarak tanımlanır)

// Uzantı kurulduğunda varsayılan olarak extensionEnabled = true yapıyoruz
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ extensionEnabled: true });
  });
  