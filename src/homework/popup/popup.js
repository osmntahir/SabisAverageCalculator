const DEFAULT_SETTINGS = {
  dueSoonDays: 3,
  longTermDays: 10
};

const SABIS_HOME_URL = "https://obs.sabis.sakarya.edu.tr/";

const categoryOrder = ["dueSoon", "longTerm", "overdue"];

const statusMessageEl = document.querySelector("#status-message");
const noteStatusEl = document.querySelector("#status");
const noteToggleEl = document.querySelector("#extToggle");
const assignmentsContainer = document.querySelector("#assignments-container");
const examsContainer = document.querySelector("#exams-container");
const lastUpdatedEl = document.querySelector("#last-updated");
const openSabisLink = document.querySelector("#open-sabis");
const openSettingsLink = document.querySelector("#open-settings");
const refreshButton = document.querySelector("#refresh-button");
const tabsNav = document.querySelector("#category-tabs");
const tabButtons = Array.from(document.querySelectorAll("[data-category-tab]"));
const modeTabs = document.querySelector("#mode-tabs");
const modeButtons = Array.from(document.querySelectorAll("[data-mode-tab]"));
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const template = document.querySelector("#assignment-template");
const examTemplate = document.querySelector("#exam-template");

let activeCategory = "dueSoon";
let activeMode = "assignments";
let filterText = "";
let sortOption = "dateAsc";

async function initNoteToggle() {
  if (!noteStatusEl || !noteToggleEl) {
    return;
  }

  const { extensionEnabled = true } =
    await chrome.storage.local.get("extensionEnabled");
  noteToggleEl.checked = extensionEnabled;
  noteStatusEl.textContent = extensionEnabled ? "Not aktif" : "Not pasif";

  noteToggleEl.addEventListener("change", async () => {
    const enabled = noteToggleEl.checked;
    await chrome.storage.local.set({ extensionEnabled: enabled });
    noteStatusEl.textContent = enabled ? "Not aktif" : "Not pasif";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.reload(tab.id);
    }
  });
}

function msToDays(ms) {
  return ms / (1000 * 60 * 60 * 24);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCountdown(diffMs) {
  const diffDays = msToDays(diffMs);
  if (diffDays <= -1) {
    return "Süresi geçti";
  }
  if (diffDays < 0) {
    return "Bugün teslim";
  }
  if (diffDays < 0.5) {
    return "Saatler içinde teslim";
  }
  return `${Math.ceil(diffDays)} gün kaldı`;
}

/**
 * Tarihi Google Calendar URL formatına çevirir: YYYYMMDDTHHmmssZ
 */
function formatDateForCalendar(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}${month}${day}T${hours}${minutes}00`;
}

/**
 * Ödev için Google Calendar URL'i oluşturur
 * Teslim saatinden 1 saat önce başlayan etkinlik oluşturur
 */
function generateAssignmentCalendarUrl(title, dueTimestamp) {
  const dueDate = new Date(dueTimestamp);

  // Etkinlik tam teslim saatinde biter (Varsayılan 1 saat süre)
  const startDate = new Date(dueDate);
  const endDate = new Date(dueDate);
  endDate.setHours(dueDate.getHours() + 1);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[SABİS] Ödev Teslimi: ${title}`,
    dates: `${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}`,
    details: `SABİS Ödev Teslimi\n\nÖdev: ${title}\nTeslim Tarihi: ${formatDate(dueDate)}\n\n⚠️ Tavsiye: Hatırlatıcıyı 1 gün önceye kurunuz!`,
    location: "SABİS - Sakarya Üniversitesi"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Sınav için Google Calendar URL'i oluşturur (30 dakika önce alarm)
 */
function generateExamCalendarUrl(title, dueTimestamp) {
  const examDate = new Date(dueTimestamp);

  // Sınav süresi: başlangıç - 1 saat sonra
  const endDate = new Date(examDate);
  endDate.setHours(examDate.getHours() + 1);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[SABİS] Kısa Sınav: ${title}`,
    dates: `${formatDateForCalendar(examDate)}/${formatDateForCalendar(endDate)}`,
    details: `SABİS Kısa Sınav\n\nDers: ${title}\nSınav Zamanı: ${formatDate(examDate)}\n\n⚠️ Sınava zamanında katılmayı unutmayın!`,
    location: "SABİS - Sakarya Üniversitesi"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function categorizeItems(items, settings) {
  const now = Date.now();
  const groups = {
    dueSoon: [],
    longTerm: [],
    overdue: []
  };

  // 1. Filtreleme (Arama)
  const filteredItems = items.filter(item => {
    if (!filterText) return true;
    const title = (item.title || "").toLocaleLowerCase('tr');
    const query = filterText.toLocaleLowerCase('tr');
    return title.includes(query);
  });

  // 2. Gruplama
  filteredItems.forEach((item) => {
    if (!item.dueTimestamp) {
      return;
    }

    const diffMs = item.dueTimestamp - now;
    const diffDays = msToDays(diffMs);

    if (diffDays < 0) {
      groups.overdue.push({ ...item, diffMs });
    } else if (diffDays <= settings.dueSoonDays) {
      groups.dueSoon.push({ ...item, diffMs });
    } else if (diffDays >= settings.longTermDays) {
      groups.longTerm.push({ ...item, diffMs });
    } else {
      groups.dueSoon.push({ ...item, diffMs });
    }
  });

  // 3. Sıralama
  const sortFn = (a, b) => {
    const timeA = a.dueTimestamp ?? Infinity;
    const timeB = b.dueTimestamp ?? Infinity;
    const distA = Math.abs(timeA - now);
    const distB = Math.abs(timeB - now);
    const titleA = (a.title || "").toLocaleLowerCase('tr');
    const titleB = (b.title || "").toLocaleLowerCase('tr');

    switch (sortOption) {
      case "dateAsc": // Tarihe Göre (Yakın)
        // En küçük mesafe (en yakın) en üstte
        // Tarihi olmayanlar (Infinity) en sona
        if (timeA === Infinity) return 1;
        if (timeB === Infinity) return -1;
        return distA - distB;
      case "dateDesc": // Tarihe Göre (Uzak)
        // En büyük mesafe (en uzak) en üstte
        // Tarihi olmayanlar en başa mı sona mı? Uzak dediği için en başa mantıklı olabilir ama
        // genelde "tarihsiz" sona atılır. Biz standart davranalım.
        if (timeA === Infinity) return 1;
        if (timeB === Infinity) return -1;
        return distB - distA;
      case "nameAsc": // İsme Göre (A-Z)
        return titleA.localeCompare(titleB);
      case "nameDesc": // İsme Göre (Z-A)
        return titleB.localeCompare(titleA);
      default:
        // Default Yakın
        if (timeA === Infinity) return 1;
        if (timeB === Infinity) return -1;
        return distA - distB;
    }
  };

  categoryOrder.forEach((category) => {
    groups[category].sort(sortFn);
  });

  return groups;
}

function createAssignmentElement(assignment) {
  const clone = template.content.firstElementChild.cloneNode(true);
  const titleEl = clone.querySelector(".assignment-title");
  const dueLabelEl = clone.querySelector(".due-label");
  const dueCountdownEl = clone.querySelector(".due-countdown");
  const calendarBtn = clone.querySelector(".calendar-btn");

  titleEl.textContent = assignment.title || "Başlık bulunamadı";

  if (assignment.dueTimestamp) {
    const dueDate = new Date(assignment.dueTimestamp);
    dueLabelEl.textContent = formatDate(dueDate);
    const diffMs =
      assignment.diffMs ?? assignment.dueTimestamp - Date.now();
    dueCountdownEl.textContent = formatCountdown(diffMs);

    // Takvim butonuna URL ata
    calendarBtn.href = generateAssignmentCalendarUrl(
      assignment.title || "Ödev",
      assignment.dueTimestamp
    );
  } else {
    dueLabelEl.textContent = assignment.dueDateText || "Tarih bulunamadı";
    dueCountdownEl.textContent = "";
    // Tarih yoksa butonu kaldır
    calendarBtn.remove();
  }

  return clone;
}

function createExamElement(exam) {
  const clone = examTemplate.content.firstElementChild.cloneNode(true);
  const titleEl = clone.querySelector(".assignment-title");
  const dueLabelEl = clone.querySelector(".due-label");
  const dueCountdownEl = clone.querySelector(".due-countdown");
  const joinButton = clone.querySelector(".exam-join");
  const calendarBtn = clone.querySelector(".calendar-btn");

  titleEl.textContent = exam.title || "Başlık bulunamadı";

  if (exam.dueTimestamp) {
    const dueDate = new Date(exam.dueTimestamp);
    dueLabelEl.textContent = formatDate(dueDate);
    const diffMs = exam.diffMs ?? exam.dueTimestamp - Date.now();
    dueCountdownEl.textContent = formatCountdown(diffMs);

    // Takvim butonuna URL ata
    calendarBtn.href = generateExamCalendarUrl(
      exam.title || "Sınav",
      exam.dueTimestamp
    );
  } else {
    dueLabelEl.textContent = exam.dateRangeText || "Tarih bulunamadı";
    dueCountdownEl.textContent = exam.statusText || "";
    // Tarih yoksa butonu kaldır
    calendarBtn.remove();
  }

  if (exam.joinUrl) {
    joinButton.href = exam.joinUrl;
  } else {
    joinButton.remove();
  }

  return clone;
}

function clearCategories(container) {
  container.querySelectorAll(".category").forEach((categoryEl) => {
    categoryEl.classList.add("empty");
  });
  container.querySelectorAll(".category-body").forEach((body) => {
    body.innerHTML = "";
  });
}

function renderAssignments(groups) {
  clearCategories(assignmentsContainer);

  categoryOrder.forEach((category) => {
    const categoryEl = assignmentsContainer.querySelector(
      `.category[data-category="${category}"]`
    );
    if (!categoryEl) {
      return;
    }

    const body = categoryEl.querySelector(".category-body");
    const items = groups[category];

    if (!items?.length) {
      categoryEl.classList.add("empty");
      return;
    }

    categoryEl.classList.remove("empty");
    body.innerHTML = "";
    items.forEach((assignment) => {
      const element = createAssignmentElement(assignment);
      body.appendChild(element);
    });
  });
}

function renderExams(groups) {
  clearCategories(examsContainer);

  categoryOrder.forEach((category) => {
    const categoryEl = examsContainer.querySelector(
      `.category[data-category="${category}"]`
    );
    if (!categoryEl) {
      return;
    }

    const body = categoryEl.querySelector(".category-body");
    const items = groups[category];

    if (!items?.length) {
      categoryEl.classList.add("empty");
      return;
    }

    categoryEl.classList.remove("empty");
    body.innerHTML = "";
    items.forEach((exam) => {
      const element = createExamElement(exam);
      body.appendChild(element);
    });
  });
}

function updateCategoryVisibilityFor(container) {
  container.querySelectorAll(".category").forEach((section) => {
    const category = section.dataset.category;
    const isActive = category === activeCategory;
    section.hidden = !isActive;
    section.setAttribute("aria-hidden", String(!isActive));
  });
}

function updateTabStates() {
  tabButtons.forEach((button) => {
    const category = button.dataset.categoryTab;
    const isActive = category === activeCategory;
    button.setAttribute("aria-selected", String(isActive));
    button.classList.toggle("is-active", isActive);
  });
}

function setActiveCategory(category, { focus = true } = {}) {
  if (!categoryOrder.includes(category)) {
    return;
  }

  activeCategory = category;
  updateTabStates();
  updateCategoryVisibilityFor(getActiveContainer());

  if (focus) {
    const activeButton = tabButtons.find(
      (btn) => btn.dataset.categoryTab === category
    );
    activeButton?.focus();
  }
}

function ensureActiveCategory(groups) {
  if (groups[activeCategory]?.length) {
    updateCategoryVisibilityFor(getActiveContainer());
    updateTabStates();
    return;
  }

  const fallback =
    categoryOrder.find((category) => groups[category]?.length) ||
    categoryOrder[0];
  setActiveCategory(fallback, { focus: false });
}

function setStatus(message, type = "info") {
  statusMessageEl.textContent = message;
  statusMessageEl.dataset.status = type;
}

function toggleMainVisibility(show) {
  const showAssignments = show && activeMode === "assignments";
  const showExams = show && activeMode === "exams";
  assignmentsContainer.hidden = !showAssignments;
  examsContainer.hidden = !showExams;
  tabsNav.hidden = !show;
  modeTabs.hidden = false;
}

function getActiveContainer() {
  return activeMode === "exams" ? examsContainer : assignmentsContainer;
}

function updateModeTabs() {
  modeButtons.forEach((button) => {
    const mode = button.dataset.modeTab;
    const isActive = mode === activeMode;
    button.setAttribute("aria-selected", String(isActive));
    button.classList.toggle("is-active", isActive);
  });
}

function setActiveMode(mode) {
  if (!["assignments", "exams"].includes(mode)) {
    return;
  }

  activeMode = mode;
  updateModeTabs();
  updateTabStates();
  updateCategoryVisibilityFor(getActiveContainer());

  if (activeMode === "assignments") {
    fetchAssignments();
  } else {
    fetchExams();
  }
}

async function fetchAssignments() {
  setStatus("Veriler toplanıyor...", "info");
  toggleMainVisibility(false);
  lastUpdatedEl.textContent = "";

  try {
    const settings = await loadSettings();
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_ASSIGNMENTS"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Bilinmeyen hata");
    }

    const { assignments, collectedAt, sourceUrl, fromCache } = response.data;
    if (!assignments?.length) {
      setStatus(
        "Ödev duyurusu bulunamadı. SABİS duyurularında yeni içerik olup olmadığını kontrol edin.",
        "warning"
      );
      return;
    }

    const groups = categorizeItems(assignments, settings);
    renderAssignments(groups);
    ensureActiveCategory(groups);

    toggleMainVisibility(true);

    if (fromCache) {
      setStatus(`Toplam ${assignments.length} ödev (önbellekten). Güncel veri için SABİS'e giriş yapın.`, "warning");
    } else {
      setStatus(`Toplam ${assignments.length} ödev bulundu.`, "success");
    }

    if (collectedAt) {
      const collectedDate = new Date(collectedAt);
      const prefix = fromCache ? "Son veri: " : "Güncelleme: ";
      lastUpdatedEl.textContent = `${prefix}${formatDate(collectedDate)}`;
    }

    openSabisLink.href = SABIS_HOME_URL;
  } catch (error) {
    toggleMainVisibility(false);
    lastUpdatedEl.textContent = "";
    setStatus(error.message, "error");
  }
}

async function fetchExams() {
  setStatus("Sınavlar toplanıyor...", "info");
  toggleMainVisibility(false);
  lastUpdatedEl.textContent = "";

  try {
    const settings = await loadSettings();
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_EXAMS"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Bilinmeyen hata");
    }

    const { exams, collectedAt, fromCache } = response.data;
    if (!exams?.length) {
      setStatus(
        "Sınav listesi bulunamadı. SABİS'te aktif dönemin açık olduğundan emin olun.",
        "warning"
      );
      return;
    }

    const groups = categorizeItems(exams, settings);
    renderExams(groups);
    ensureActiveCategory(groups);

    toggleMainVisibility(true);

    if (fromCache) {
      setStatus(`Toplam ${exams.length} sınav (önbellekten). Güncel veri için SABİS'e giriş yapın.`, "warning");
    } else {
      setStatus(`Toplam ${exams.length} sınav bulundu.`, "success");
    }

    if (collectedAt) {
      const collectedDate = new Date(collectedAt);
      const prefix = fromCache ? "Son veri: " : "Güncelleme: ";
      lastUpdatedEl.textContent = `${prefix}${formatDate(collectedDate)}`;
    }

    openSabisLink.href = SABIS_HOME_URL;
  } catch (error) {
    toggleMainVisibility(false);
    lastUpdatedEl.textContent = "";
    setStatus(error.message, "error");
  }
}

function initEventListeners() {
  refreshButton.addEventListener("click", () => {
    if (activeMode === "assignments") {
      fetchAssignments();
    } else {
      fetchExams();
    }
  });

  openSettingsLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.categoryTab;
      setActiveCategory(category);
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.modeTab;
      setActiveMode(mode);
    });
  });

  // Arama ve Sıralama Olayları
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterText = e.target.value.trim();
      if (activeMode === "assignments") fetchAssignments();
      else fetchExams();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortOption = e.target.value;
      if (activeMode === "assignments") fetchAssignments();
      else fetchExams();
    });
  }
}

async function init() {
  initEventListeners();
  updateModeTabs();
  updateCategoryVisibilityFor(getActiveContainer());
  updateTabStates();
  await initNoteToggle();
  await fetchAssignments();
}

document.addEventListener("DOMContentLoaded", init);
