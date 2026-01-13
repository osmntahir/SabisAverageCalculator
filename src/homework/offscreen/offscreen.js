import { collectAssignmentsPayloadFromHtml } from "../shared/collector.js";
import { collectExamsPayloadFromHtml } from "../shared/exam-collector.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen") {
    return undefined;
  }

  if (message?.type === "OFFSCREEN_COLLECT") {
    try {
      const payload = collectAssignmentsPayloadFromHtml(
        message.html || "",
        message.sourceUrl || ""
      );
      sendResponse({ ok: true, data: payload });
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error);
      sendResponse({ ok: false, error: messageText });
    }

    return true;
  }

  if (message?.type === "OFFSCREEN_COLLECT_EXAMS") {
    try {
      const payload = collectExamsPayloadFromHtml(
        message.html || "",
        message.sourceUrl || ""
      );
      sendResponse({ ok: true, data: payload });
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error);
      sendResponse({ ok: false, error: messageText });
    }

    return true;
  }

  return undefined;
});
