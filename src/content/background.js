// background.js – Manifest v3 service_worker
chrome.runtime.onInstalled.addListener(() =>
  chrome.storage.local.set({ extensionEnabled: true })
);
