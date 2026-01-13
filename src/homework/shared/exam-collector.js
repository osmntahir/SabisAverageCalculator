const DATE_RANGE_REGEX =
  /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;

function normaliseWhitespace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function toTimestamp(day, month, year, hour, minute, second) {
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second || 0),
    0
  );
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function parseDateRange(text) {
  const match = (text || "").match(DATE_RANGE_REGEX);
  if (!match) {
    return null;
  }

  const [
    ,
    startDay,
    startMonth,
    startYear,
    startHour,
    startMinute,
    startSecond,
    endDay,
    endMonth,
    endYear,
    endHour,
    endMinute,
    endSecond
  ] = match;

  const startTimestamp = toTimestamp(
    startDay,
    startMonth,
    startYear,
    startHour,
    startMinute,
    startSecond
  );
  const endTimestamp = toTimestamp(
    endDay,
    endMonth,
    endYear,
    endHour,
    endMinute,
    endSecond
  );

  if (!startTimestamp || !endTimestamp) {
    return null;
  }

  return {
    startTimestamp,
    endTimestamp
  };
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

function collectExamRows(doc) {
  const scope = doc?.querySelector("table tbody");
  if (!scope) {
    return [];
  }

  return Array.from(scope.querySelectorAll("tr"));
}

function mapRowToExam(row, baseUrl) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (!cells.length) {
    return null;
  }

  const title = normaliseWhitespace(cells[0]?.textContent);
  const dateRangeText = normaliseWhitespace(cells[1]?.textContent);
  const statusText = normaliseWhitespace(cells[2]?.textContent);
  const joinLink = row.querySelector("a[href*='/Session/Exam/Join/']");
  const joinUrl = toAbsoluteUrl(joinLink?.getAttribute("href"), baseUrl);

  const range = parseDateRange(dateRangeText);
  const dueTimestamp = range?.endTimestamp ?? null;

  if (!title) {
    return null;
  }

  return {
    title,
    dateRangeText,
    statusText,
    dueTimestamp,
    joinUrl
  };
}

function collectExamsFromDocument(doc, sourceUrl) {
  const rows = collectExamRows(doc);
  return rows
    .map((row) => mapRowToExam(row, sourceUrl))
    .filter(Boolean);
}

function withMetadata(exams, sourceUrl) {
  return {
    exams,
    collectedAt: new Date().toISOString(),
    sourceUrl
  };
}

export function collectExamsPayloadFromHtml(html, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const effectiveSourceUrl = sourceUrl || doc?.baseURI || "";
  const exams = collectExamsFromDocument(doc, effectiveSourceUrl);
  return withMetadata(exams, effectiveSourceUrl);
}
