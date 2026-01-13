const DUE_DATE_REGEX =
  /(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s*(\d{1,2}):(\d{2}))?/;
const DUE_TEXT_REGEX = /(son teslim|teslim tarihi)/i;

const HOMEWORK_KEYWORDS = ["odev", "homework", "assignment"];
const HOMEWORK_STRICT_PATTERNS = [/yeni odeviniz var/i, /odeviniz var/i];
const NON_HOMEWORK_KEYWORDS = [
  { value: "panel", penaltyTitle: 2, penaltyText: 1 },
  { value: "paneli", penaltyTitle: 2, penaltyText: 1 },
  { value: "buton", penaltyTitle: 2, penaltyText: 1 },
  { value: "button", penaltyTitle: 2, penaltyText: 1 },
  { value: "basvuru", penaltyTitle: 2, penaltyText: 1 },
  { value: "form", penaltyTitle: 1, penaltyText: 1 },
  { value: "etkinlik", penaltyTitle: 2, penaltyText: 1 },
  { value: "seminer", penaltyTitle: 2, penaltyText: 1 },
  { value: "konferans", penaltyTitle: 2, penaltyText: 1 },
  { value: "calistay", penaltyTitle: 2, penaltyText: 1 },
  { value: "workshop", penaltyTitle: 2, penaltyText: 1 },
  { value: "duyuru", penaltyTitle: 1, penaltyText: 1 },
  { value: "duyurusu", penaltyTitle: 1, penaltyText: 1 },
  { value: "duyurular", penaltyTitle: 1, penaltyText: 1 }
];
const EXCLUDED_NODE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "OPTION",
  "SELECT",
  "INPUT",
  "TEXTAREA",
  "LABEL",
  "SVG",
  "IFRAME"
]);

function normaliseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normaliseForMatch(text) {
  if (!text) {
    return "";
  }

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase("tr-TR");
}

function hasHomeworkKeywordNearDueDate(text, dueText) {
  if (!text || !dueText) {
    return false;
  }

  const normalisedText = normaliseForMatch(text);
  const normalisedDue = normaliseForMatch(dueText);
  if (!normalisedDue) {
    return false;
  }

  const index = normalisedText.indexOf(normalisedDue);
  const windowSize = 220;

  if (index === -1) {
    // Fall back to checking the whole text if due date fragment is not found.
    return HOMEWORK_KEYWORDS.some((keyword) =>
      normalisedText.includes(keyword)
    );
  }

  const start = Math.max(0, index - windowSize);
  const end = Math.min(
    normalisedText.length,
    index + normalisedDue.length + windowSize
  );
  const windowText = normalisedText.slice(start, end);

  return HOMEWORK_KEYWORDS.some((keyword) => windowText.includes(keyword));
}

function evaluateAssignmentSignals({ text, title, dueText, hasWarning }) {
  const strictMatchText = HOMEWORK_STRICT_PATTERNS.some((pattern) =>
    pattern.test(text || "")
  );
  const strictMatchTitle =
    title && HOMEWORK_STRICT_PATTERNS.some((pattern) => pattern.test(title));

  const normalisedText = normaliseForMatch(text || "");
  const normalisedTitle = normaliseForMatch(title || "");

  const keywordNearDueDateInText = hasHomeworkKeywordNearDueDate(
    text,
    dueText
  );
  const keywordNearDueDateInTitle = hasHomeworkKeywordNearDueDate(
    title || "",
    dueText
  );

  const hasKeywordNearDueDate =
    keywordNearDueDateInText || keywordNearDueDateInTitle;
  const hasKeywordInText = HOMEWORK_KEYWORDS.some((keyword) =>
    normalisedText.includes(keyword)
  );
  const hasKeywordInTitle = HOMEWORK_KEYWORDS.some((keyword) =>
    normalisedTitle.includes(keyword)
  );
  const hasAnyHomeworkKeyword = hasKeywordInText || hasKeywordInTitle;

  let positive = 0;
  if (strictMatchText) {
    positive += 3;
  }
  if (strictMatchTitle) {
    positive += 3;
  }
  if (hasKeywordNearDueDate) {
    positive += 2;
  } else if (hasKeywordInText) {
    positive += 1;
  }
  if (hasKeywordInTitle) {
    positive += 1;
  }
  if (hasWarning) {
    positive += 1;
  }

  let negative = 0;
  for (const keyword of NON_HOMEWORK_KEYWORDS) {
    if (keyword.value && normalisedTitle.includes(keyword.value)) {
      negative += keyword.penaltyTitle;
    }
    if (keyword.value && normalisedText.includes(keyword.value)) {
      negative += keyword.penaltyText;
    }
  }

  return {
    positive,
    negative,
    total: positive - negative,
    hasKeywordNearDueDate,
    hasAnyHomeworkKeyword,
    hasStrictMatch: strictMatchText || strictMatchTitle
  };
}

function parseDueDate(text) {
  const match = text.match(DUE_DATE_REGEX);
  if (!match) {
    return null;
  }

  const [, rawDay, rawMonth, rawYear, rawHour, rawMinute] = match;
  const day = Number(rawDay);
  const month = Number(rawMonth) - 1;
  const year = Number(rawYear);
  const hour = rawHour !== undefined ? Number(rawHour) : 23;
  const minute = rawMinute !== undefined ? Number(rawMinute) : 59;

  const candidate = new Date(year, month, day, hour, minute, 0, 0);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return {
    iso: candidate.toISOString(),
    timestamp: candidate.getTime(),
    text: match[0].trim()
  };
}

function getTitleFromCard(card) {
  const heading =
    card.querySelector("a") ||
    card.querySelector("h1, h2, h3, h4, h5, h6") ||
    card.querySelector("strong, b");

  if (!heading) {
    return null;
  }

  return normaliseWhitespace(heading.textContent || "");
}

function toAbsoluteUrl(href, baseUrl) {
  if (!href) {
    return "";
  }

  try {
    return new URL(href, baseUrl || globalThis.location?.href || undefined).toString();
  } catch {
    return href;
  }
}

function collectCandidateCards(root) {
  const scope = root instanceof Document ? root.body : root;
  if (!scope) {
    return [];
  }

  const nodes = Array.from(scope.querySelectorAll("*")).filter((el) => {
    if (EXCLUDED_NODE_TAGS.has(el.tagName)) {
      return false;
    }
    if (el.getAttribute("role") === "button") {
      return false;
    }
    const text = el.textContent || "";
    if (text.length < 12) {
      return false;
    }
    return DUE_TEXT_REGEX.test(text) && DUE_DATE_REGEX.test(text);
  });

  const seen = new Set();
  const cards = [];

  for (const node of nodes) {
    const card =
      node.closest(
        [
          ".notification",
          ".notifications__item",
          ".duyuru",
          ".timeline-item",
          ".list-group-item",
          ".card",
          "article"
        ].join(", ")
      ) || node;

    if (!seen.has(card)) {
      seen.add(card);
      cards.push(card);
    }
  }

  return cards;
}

function hasWarningMarker(card) {
  if (card.querySelector("[class*='warning']")) {
    return true;
  }

  const style = card.getAttribute("style") || "";
  return /warning|ffa800|fbb03b/i.test(style);
}

function mapCardToAssignment(card, baseUrl) {
  const text = normaliseWhitespace(card.textContent || "");
  const dueInfo = parseDueDate(text);
  const title = getTitleFromCard(card);

  const warningMarker = hasWarningMarker(card);
  const signals = evaluateAssignmentSignals({
    text,
    title,
    dueText: dueInfo?.text,
    hasWarning: warningMarker
  });

  if (
    !signals.hasStrictMatch &&
    !signals.hasKeywordNearDueDate &&
    !warningMarker
  ) {
    return null;
  }

  if (!signals.hasAnyHomeworkKeyword && !signals.hasStrictMatch) {
    return null;
  }

  if (signals.positive === 0 || signals.total <= 0) {
    return null;
  }

  if (!dueInfo) {
    return null;
  }

  const assignmentTitle =
    title && title.length > 3 ? title : text.split(".")[0] || "Baslik bulunamadi";

  return {
    title: normaliseWhitespace(assignmentTitle),
    dueDate: dueInfo.iso,
    dueDateText: dueInfo.text,
    dueTimestamp: dueInfo.timestamp,
    sourceUrl: toAbsoluteUrl(card.querySelector("a")?.href || "", baseUrl),
    __rawText: normaliseForMatch(text)
  };
}

function collectAssignmentsFromRoot(root, baseUrl) {
  const cards = collectCandidateCards(root);

  const assignments = cards
    .map((card) => mapCardToAssignment(card, baseUrl))
    .filter(Boolean);

  function choosePreferredAssignment(first, second) {
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }

    if (!first.sourceUrl && second.sourceUrl) {
      return second;
    }
    if (!second.sourceUrl && first.sourceUrl) {
      return first;
    }

    return first;
  }

  const dedupedMap = new Map();

  function createDeduplicationKey(assignment) {
    const dueKey =
      assignment.dueTimestamp != null
        ? `ts:${assignment.dueTimestamp}`
        : `txt:${normaliseForMatch(
            assignment.dueDateText || assignment.dueDate || ""
          )}`;
    const rawKey = assignment.__rawText || "";
    const sourceKey = assignment.sourceUrl
      ? normaliseForMatch(assignment.sourceUrl)
      : "";
    return [dueKey, rawKey, sourceKey].join("::");
  }

  for (const assignment of assignments) {
    const key = createDeduplicationKey(assignment);
    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, assignment);
      continue;
    }

    const preferred = choosePreferredAssignment(existing, assignment);
    if (preferred !== existing) {
      dedupedMap.set(key, preferred);
    }
  }

  const deduped = Array.from(dedupedMap.values()).map((assignment) => {
    const result = { ...assignment };
    delete result.__rawText;
    return result;
  });

  deduped.sort(
    (a, b) => (a.dueTimestamp ?? Infinity) - (b.dueTimestamp ?? Infinity)
  );

  return deduped;
}

function withMetadata(assignments, sourceUrl) {
  return {
    assignments,
    collectedAt: new Date().toISOString(),
    sourceUrl
  };
}

export function collectAssignmentsPayloadFromDocument(doc, sourceUrl) {
  const effectiveSourceUrl = sourceUrl || doc?.baseURI || "";
  const assignments = collectAssignmentsFromRoot(doc, effectiveSourceUrl);
  return withMetadata(assignments, effectiveSourceUrl);
}

export function collectAssignmentsPayloadFromHtml(html, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const effectiveSourceUrl = sourceUrl || doc?.baseURI || "";
  return collectAssignmentsPayloadFromDocument(doc, effectiveSourceUrl);
}

export function collectAssignmentsFromRootForTests(root, baseUrl) {
  return collectAssignmentsFromRoot(root, baseUrl);
}
