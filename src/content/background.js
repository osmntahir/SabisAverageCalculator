import { collectAssignmentsPayloadFromHtml } from "../homework/shared/collector.js";
import { collectExamsPayloadFromHtml } from "../homework/shared/exam-collector.js";

const OBS_MATCH_PATTERN = "*://*.sabis.sakarya.edu.tr/*";
const SABIS_HOME_URL = "https://obs.sabis.sakarya.edu.tr/";
const COLLECTOR_NOT_READY = "COLLECTOR_NOT_READY";
const HOMEWORK_POPUP_URL = "src/homework/popup/popup.html";
const HOMEWORK_MENU_ID = "open-homework-popup";
const SABIS_EXAM_URL = "https://esinav.sabis.sakarya.edu.tr/Session/Exam";

const CACHE_KEY_ASSIGNMENTS = "cachedAssignments";
const CACHE_KEY_EXAMS = "cachedExams";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 saat

const AUTO_UPDATE_ALARM_NAME = "sabis-auto-update";
const AUTO_UPDATE_INTERVAL_MINUTES = 15; // Her 15 dakikada bir güncelle
const LAST_AUTO_UPDATE_KEY = "lastAutoUpdate";

const COLLECTOR_TIMEOUT_MS = 15000;
const COLLECTOR_RETRY_DELAY_MS = 300;
const ANNOUNCEMENT_PATH_CANDIDATES = [
  "Duyuru",
  "Duyuru/",
  "Duyurular",
  "Duyurular/",
  "Duyuru/Index",
  "Duyuru/Announcements",
  "Home/Duyuru",
  "Home/Duyurular",
  "Home/Announcements",
  "Announcement",
  "Announcements"
];

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isCollectorHandshakeError(message) {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist") ||
    message.includes("The message port closed before a response was received")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUrl(href, baseUrl) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl || SABIS_HOME_URL).toString();
  } catch {
    return null;
  }
}

function findAnnouncementUrl(html, baseUrl) {
  const regex = /href=["']([^"']*duyuru[^"']*)["']/gi;
  let match = regex.exec(html || "");
  while (match) {
    const candidate = resolveUrl(match[1], baseUrl);
    if (candidate) {
      return candidate;
    }
    match = regex.exec(html || "");
  }
  return null;
}

function extractRequestVerificationToken(html) {
  if (!html) {
    return null;
  }

  const tokenInput = html.match(
    /name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i
  );
  if (tokenInput && tokenInput[1]) {
    return tokenInput[1];
  }

  const tokenFromScript = html.match(
    /__RequestVerificationToken["']\s*type=["']hidden["']\s*value=["']([^"']+)["']/i
  );
  if (tokenFromScript && tokenFromScript[1]) {
    return tokenFromScript[1];
  }

  return null;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow"
  });

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new Error(`HTTP ${response.status}${statusText}`);
  }

  const html = await response.text();
  const sourceUrl = response.url || url;
  return { html, sourceUrl };
}

async function fetchAnnouncementComponent(baseUrl, token) {
  if (!token) {
    throw new Error("REQUEST_VERIFICATION_TOKEN_MISSING");
  }

  const endpoint = resolveUrl("/Component/GenelDuyuru", baseUrl);
  if (!endpoint) {
    throw new Error("ANNOUNCEMENT_ENDPOINT_MISSING");
  }

  const body = new URLSearchParams({
    __RequestVerificationToken: token
  });

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    redirect: "follow",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body
  });

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new Error(`HTTP ${response.status}${statusText}`);
  }

  const html = await response.text();
  const sourceUrl = response.url || endpoint;
  return { html, sourceUrl };
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    throw new Error("Offscreen doküman desteklenmiyor.");
  }

  if (chrome.offscreen.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) {
      return;
    }
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("src/homework/offscreen/offscreen.html"),
    reasons: ["DOM_PARSER"],
    justification:
      "SABİS sayfasını arka planda görünür sekme açmadan ayrıştırabilmek."
  });
}

async function closeOffscreenDocument() {
  if (!chrome.offscreen?.closeDocument) {
    return;
  }

  if (chrome.offscreen.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      return;
    }
  }

  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // No-op: kapatma sirasinda hata olursa yoksay.
  }
}

function isAnnouncementTab(tab) {
  const url = tab?.url || "";
  return /duyuru/i.test(url);
}

async function getPreferredSabisTab() {
  const tabs = await chrome.tabs.query({ url: OBS_MATCH_PATTERN });
  if (!tabs.length) {
    return null;
  }

  const announcementTab = tabs.find(isAnnouncementTab);
  if (announcementTab) {
    return announcementTab;
  }

  const activeTab = tabs.find((tab) => tab.active && tab.lastFocusedWindow);
  return activeTab || tabs[0];
}

async function waitForTabReady(tabId, timeoutMs = 15000) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) {
    throw new Error("TAB_NOT_FOUND");
  }
  if (tab.status === "complete") {
    return;
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("TAB_LOAD_TIMEOUT"));
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve();
      }
    };

    const onRemoved = (removedTabId) => {
      if (removedTabId === tabId) {
        cleanup();
        reject(new Error("TAB_CLOSED"));
      }
    };

    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  }).catch(() => { });
}

async function findReadySabisTab() {
  const tab = await getPreferredSabisTab();
  if (!tab) {
    return null;
  }

  await waitForTabReady(tab.id).catch(() => { });
  return tab;
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["src/homework/content/content-script.js"]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `İçerik betiği enjekte edilemedi. Sekmeyi yenileyip tekrar deneyin. Hata: ${message}`
    );
  }
}

async function tryCollectAssignments(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "COLLECT_ASSIGNMENTS"
    });

    if (!response) {
      return { ok: false, error: "COLLECTOR_RETURNED_NOTHING" };
    }

    return { ok: true, data: response };
  } catch (error) {
    const message = toErrorMessage(error);
    if (isCollectorHandshakeError(message)) {
      return { ok: false, error: COLLECTOR_NOT_READY, code: COLLECTOR_NOT_READY };
    }

    return { ok: false, error: message, code: "SEND_MESSAGE_FAILED" };
  }
}

async function collectWithRetries(tabId) {
  await injectContentScript(tabId);

  const deadline = Date.now() + COLLECTOR_TIMEOUT_MS;
  let lastError = COLLECTOR_NOT_READY;

  while (Date.now() < deadline) {
    const result = await tryCollectAssignments(tabId);
    if (result.ok) {
      return result.data;
    }

    if (result.code === "SEND_MESSAGE_FAILED") {
      throw new Error(
        `İçerik betiği iletişimi kurulamadı. Hata: ${result.error}`
      );
    }

    if (result.code === COLLECTOR_NOT_READY || result.error === COLLECTOR_NOT_READY) {
      await injectContentScript(tabId);
      await sleep(COLLECTOR_RETRY_DELAY_MS);
      continue;
    }

    lastError = result.error || "Bilinmeyen hata";
    break;
  }

  if (lastError === COLLECTOR_NOT_READY) {
    throw new Error(
      "İçerik betiği hazır değil. Lütfen SABİS sekmesinin tam yüklendiğinden emin olun."
    );
  }

  throw new Error(`İçerik betiği veri döndüremedi. Hata: ${lastError}`);
}

async function fetchAssignmentsFromTab(tab) {
  return collectWithRetries(tab.id);
}

function normalisePayload(payload, tabId) {
  const data = payload || {};
  const collectedAt = data.collectedAt || new Date().toISOString();
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const sourceUrl = data.sourceUrl || SABIS_HOME_URL;
  return {
    assignments,
    collectedAt,
    sourceUrl,
    tabId,
    metadata: data.metadata
  };
}

async function collectAssignmentsViaOffscreen(html, sourceUrl) {
  await ensureOffscreenDocument();

  const result = await chrome.runtime
    .sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_COLLECT",
      html,
      sourceUrl
    })
    .catch((error) => ({
      ok: false,
      error: toErrorMessage(error)
    }));

  if (!result) {
    throw new Error("Offscreen dokumandan yanit alinamadi.");
  }

  if (!result.ok) {
    throw new Error(result.error || "Offscreen parse islemi basarisiz.");
  }

  return result.data;
}

async function collectExamsViaOffscreen(html, sourceUrl) {
  await ensureOffscreenDocument();

  const result = await chrome.runtime
    .sendMessage({
      target: "offscreen",
      type: "OFFSCREEN_COLLECT_EXAMS",
      html,
      sourceUrl
    })
    .catch((error) => ({
      ok: false,
      error: toErrorMessage(error)
    }));

  if (!result) {
    throw new Error("Offscreen dokumandan yanit alinamadi.");
  }

  if (!result.ok) {
    throw new Error(result.error || "Offscreen parse islemi basarisiz.");
  }

  return result.data;
}

async function parseAssignmentsFromHtml(html, sourceUrl) {
  try {
    return collectAssignmentsPayloadFromHtml(html, sourceUrl);
  } catch (parserError) {
    const parserMessage = toErrorMessage(parserError);
    if (parserMessage.includes("DOMParser is not defined")) {
      const payload = await collectAssignmentsViaOffscreen(html, sourceUrl);
      await closeOffscreenDocument();
      return payload;
    }

    throw parserError;
  }
}

async function parseExamsFromHtml(html, sourceUrl) {
  try {
    return collectExamsPayloadFromHtml(html, sourceUrl);
  } catch (parserError) {
    const parserMessage = toErrorMessage(parserError);
    if (parserMessage.includes("DOMParser is not defined")) {
      const payload = await collectExamsViaOffscreen(html, sourceUrl);
      await closeOffscreenDocument();
      return payload;
    }

    throw parserError;
  }
}

function isLikelyLoggedOut(html, responseUrl) {
  const url = responseUrl || "";
  if (/login|giris|oturum/i.test(url)) {
    return true;
  }

  const snippet = (html || "").slice(0, 20000).toLowerCase();
  return (
    snippet.includes("giris") ||
    snippet.includes("oturum") ||
    snippet.includes("sifre") ||
    snippet.includes("parola") ||
    snippet.includes("kullanici") ||
    snippet.includes("login")
  );
}

async function fetchAssignmentsDirectly() {
  try {
    const { html, sourceUrl } = await fetchHtml(SABIS_HOME_URL);

    if (isLikelyLoggedOut(html, sourceUrl)) {
      throw new Error(
        "Oturum açık değil. SABİS'te giriş yapıp tekrar deneyin."
      );
    }

    let payload = await parseAssignmentsFromHtml(html, sourceUrl);
    if (payload?.assignments?.length) {
      return payload;
    }

    const token = extractRequestVerificationToken(html);
    if (token) {
      const componentData = await fetchAnnouncementComponent(sourceUrl, token);
      if (isLikelyLoggedOut(componentData.html, componentData.sourceUrl)) {
        throw new Error(
          "Oturum açık değil. SABİS'te giriş yapıp tekrar deneyin."
        );
      }
      payload = await parseAssignmentsFromHtml(
        componentData.html,
        componentData.sourceUrl
      );
      if (payload?.assignments?.length) {
        return payload;
      }
    }

    const triedUrls = new Set([sourceUrl]);
    const announcementUrl = findAnnouncementUrl(html, sourceUrl);
    if (announcementUrl && !triedUrls.has(announcementUrl)) {
      const announcementData = await fetchHtml(announcementUrl);
      triedUrls.add(announcementData.sourceUrl);
      if (isLikelyLoggedOut(announcementData.html, announcementData.sourceUrl)) {
        throw new Error(
          "Oturum açık değil. SABİS'te giriş yapıp tekrar deneyin."
        );
      }
      payload = await parseAssignmentsFromHtml(
        announcementData.html,
        announcementData.sourceUrl
      );
    }

    if (!payload?.assignments?.length) {
      for (const path of ANNOUNCEMENT_PATH_CANDIDATES) {
        const candidateUrl = resolveUrl(path, SABIS_HOME_URL);
        if (!candidateUrl || triedUrls.has(candidateUrl)) {
          continue;
        }
        const candidateData = await fetchHtml(candidateUrl);
        triedUrls.add(candidateData.sourceUrl);
        if (isLikelyLoggedOut(candidateData.html, candidateData.sourceUrl)) {
          throw new Error(
            "Oturum açık değil. SABİS'te giriş yapıp tekrar deneyin."
          );
        }
        payload = await parseAssignmentsFromHtml(
          candidateData.html,
          candidateData.sourceUrl
        );
        if (payload?.assignments?.length) {
          break;
        }
      }
    }

    return payload;
  } catch (error) {
    const message = toErrorMessage(error);
    throw new Error(`SABİS sayfasından veri çekilemedi. Hata: ${message}`);
  }
}

async function fetchExamsDirectly() {
  try {
    const { html, sourceUrl } = await fetchHtml(SABIS_EXAM_URL);

    if (isLikelyLoggedOut(html, sourceUrl)) {
      throw new Error(
        "Oturum açık değil. SABİS'te giriş yapıp tekrar deneyin."
      );
    }

    return await parseExamsFromHtml(html, sourceUrl);
  } catch (error) {
    const message = toErrorMessage(error);
    throw new Error(`Sınav sayfası çekilemedi. Hata: ${message}`);
  }
}

async function collectWithExistingTab() {
  const tab = await findReadySabisTab();
  if (!tab) {
    return { ok: false, error: null, code: "NO_TAB" };
  }

  try {
    const payload = await fetchAssignmentsFromTab(tab);
    return { ok: true, payload: normalisePayload(payload, tab.id) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function getCachedData(key) {
  try {
    const result = await chrome.storage.local.get(key);
    const cached = result[key];
    if (!cached) {
      return null;
    }
    // Önbellek çok eskiyse null döndür
    const age = Date.now() - (cached.cachedAt || 0);
    if (age > CACHE_MAX_AGE_MS) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

async function setCachedData(key, data) {
  try {
    await chrome.storage.local.set({
      [key]: {
        ...data,
        cachedAt: Date.now()
      }
    });
  } catch {
    // Önbellek yazma hatası sessizce yoksayılır
  }
}

async function handleFetchAssignmentsRequest() {
  // 1. Önce arka planda doğrudan fetch dene (en hızlı ve kullanıcıya iş çıkarmayan yol)
  const directResult = await (async () => {
    try {
      const payload = await fetchAssignmentsDirectly();
      const normalised = normalisePayload(payload);
      if (normalised.assignments.length) {
        // Başarılı veriyi önbelleğe al
        await setCachedData(CACHE_KEY_ASSIGNMENTS, normalised);
        return { ok: true, payload: normalised };
      }
      return { ok: false, error: "Odev bulunamadi." };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  })();

  if (directResult.ok) {
    return directResult.payload;
  }

  // 2. Arka plan başarısız olduysa, mevcut SABIS sekmesinden dene
  const existingResult = await collectWithExistingTab();
  if (existingResult.ok && existingResult.payload.assignments.length) {
    // Başarılı veriyi önbelleğe al
    await setCachedData(CACHE_KEY_ASSIGNMENTS, existingResult.payload);
    return existingResult.payload;
  }

  // 3. Her iki yöntem de başarısız olduysa, önbellekten dene
  const cached = await getCachedData(CACHE_KEY_ASSIGNMENTS);
  if (cached && cached.assignments?.length) {
    // Önbellekten dönen veriye uyarı ekle
    cached.fromCache = true;
    return cached;
  }

  // 4. Hiçbir kaynak başarılı olmadı
  throw new Error(
    "Oturum açık değil. SABİS'e giriş yaptıktan sonra tekrar deneyin."
  );
}

async function handleFetchExamsRequest() {
  // 1. Önce arka planda doğrudan fetch dene
  try {
    const payload = await fetchExamsDirectly();
    if (payload?.exams?.length) {
      // Başarılı veriyi önbelleğe al
      await setCachedData(CACHE_KEY_EXAMS, payload);
      return payload;
    }
  } catch (error) {
    // Hata durumunda önbelleğe geç
  }

  // 2. Arka plan başarısız olduysa, önbellekten dene
  const cached = await getCachedData(CACHE_KEY_EXAMS);
  if (cached && cached.exams?.length) {
    cached.fromCache = true;
    return cached;
  }

  // 3. Hiçbir kaynak başarılı olmadı
  throw new Error(
    "Oturum açık değil. SABİS'e giriş yaptıktan sonra tekrar deneyin."
  );
}

// Arka planda sessizce verileri güncelle (hata fırlatmaz)
async function silentUpdateAssignments() {
  try {
    const payload = await fetchAssignmentsDirectly();
    const normalised = normalisePayload(payload);
    if (normalised.assignments.length) {
      await setCachedData(CACHE_KEY_ASSIGNMENTS, normalised);
      return true;
    }
  } catch {
    // Sessizce başarısız ol
  }
  return false;
}

async function silentUpdateExams() {
  try {
    const payload = await fetchExamsDirectly();
    if (payload?.exams?.length) {
      await setCachedData(CACHE_KEY_EXAMS, payload);
      return true;
    }
  } catch {
    // Sessizce başarısız ol
  }
  return false;
}

async function performAutoUpdate() {
  const assignmentsOk = await silentUpdateAssignments();
  const examsOk = await silentUpdateExams();

  if (assignmentsOk || examsOk) {
    await chrome.storage.local.set({
      [LAST_AUTO_UPDATE_KEY]: new Date().toISOString()
    });
  }
}

function openHomeworkPopup() {
  chrome.tabs.create({
    url: chrome.runtime.getURL(HOMEWORK_POPUP_URL)
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ extensionEnabled: true });

  // Periyodik güncelleme alarmı kur
  chrome.alarms.create(AUTO_UPDATE_ALARM_NAME, {
    delayInMinutes: 0.5, // 30 saniye sonra ilk güncelleme
    periodInMinutes: AUTO_UPDATE_INTERVAL_MINUTES
  });

  if (chrome.contextMenus?.create) {
    chrome.contextMenus.create({
      id: HOMEWORK_MENU_ID,
      title: "Odev Takibi",
      contexts: ["action"]
    });
  }

  // Kurulum sonrası hemen güncelleme dene
  performAutoUpdate();
});

// Tarayıcı başladığında alarmı kontrol et ve güncelleme yap
chrome.runtime.onStartup?.addListener?.(async () => {
  const alarm = await chrome.alarms.get(AUTO_UPDATE_ALARM_NAME);
  if (!alarm) {
    chrome.alarms.create(AUTO_UPDATE_ALARM_NAME, {
      delayInMinutes: 0.5,
      periodInMinutes: AUTO_UPDATE_INTERVAL_MINUTES
    });
  }
  // Başlangıçta bir güncelleme dene
  performAutoUpdate();
});

// Service worker her uyandığında alarmı kontrol et
(async () => {
  try {
    const alarm = await chrome.alarms.get(AUTO_UPDATE_ALARM_NAME);
    if (!alarm) {
      chrome.alarms.create(AUTO_UPDATE_ALARM_NAME, {
        delayInMinutes: 0.5,
        periodInMinutes: AUTO_UPDATE_INTERVAL_MINUTES
      });
    }
  } catch {
    // Hata olursa sessizce geç
  }
})();

// Alarm tetiklendiğinde güncelleme yap
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_UPDATE_ALARM_NAME) {
    performAutoUpdate();
  }
});

// SABIS sayfası açıldığında veya güncellendiğinde otomatik veri çek
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Sadece sayfa tamamen yüklendiğinde
  if (changeInfo.status !== "complete") {
    return;
  }

  const url = tab.url || "";

  // SABIS ana sayfası veya duyuru sayfası açıldıysa ödevleri güncelle
  if (url.includes("obs.sabis.sakarya.edu.tr")) {
    silentUpdateAssignments();
  }

  // E-sınav sayfası açıldıysa sınavları güncelle
  if (url.includes("esinav.sabis.sakarya.edu.tr")) {
    silentUpdateExams();
  }
});

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === HOMEWORK_MENU_ID) {
      openHomeworkPopup();
    }
  });
}

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-homework-popup") {
      openHomeworkPopup();
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FETCH_ASSIGNMENTS") {
    handleFetchAssignmentsRequest()
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FETCH_EXAMS") {
    handleFetchExamsRequest()
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Content script'ten gelen otomatik güncelleme verilerini önbelleğe al
  if (message?.type === "AUTO_UPDATE_ASSIGNMENTS" && message.payload) {
    const payload = message.payload;
    if (payload.assignments?.length) {
      const normalised = normalisePayload(payload);
      setCachedData(CACHE_KEY_ASSIGNMENTS, normalised);
    }
    return false; // Yanıt bekleme
  }

  return undefined;
});
