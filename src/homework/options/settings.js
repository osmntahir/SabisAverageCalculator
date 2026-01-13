const DEFAULT_SETTINGS = {
  dueSoonDays: 3,
  longTermDays: 10,
  showCalculatorAnnounced: false
};

const form = document.querySelector("#settings-form");
const dueSoonInput = document.querySelector("#due-soon-days");
const longTermInput = document.querySelector("#long-term-days");
const showCalculatorAnnouncedInput = document.querySelector("#show-calculator-announced");
const statusEl = document.querySelector("#status");

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  dueSoonInput.value = settings.dueSoonDays;
  longTermInput.value = settings.longTermDays;
  showCalculatorAnnouncedInput.checked = settings.showCalculatorAnnounced;
}

function showStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.status = type;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const dueSoonDays = Number(dueSoonInput.value);
  const longTermDays = Number(longTermInput.value);
  const showCalculatorAnnounced = showCalculatorAnnouncedInput.checked;

  if (Number.isNaN(dueSoonDays) || Number.isNaN(longTermDays)) {
    showStatus("Geçerli bir sayı girin.", "error");
    return;
  }

  if (longTermDays <= dueSoonDays) {
    showStatus(
      "Uzun süreli gün sayısı, yaklaşan teslimat eşiğinden büyük olmalı.",
      "error"
    );
    return;
  }

  await chrome.storage.sync.set({ dueSoonDays, longTermDays, showCalculatorAnnounced });
  showStatus("Ayarlar kaydedildi.", "success");
});

loadSettings().catch((error) => {
  showStatus(`Ayarlar yüklenemedi: ${error.message}`, "error");
});
