(() => {
  if (window.__SABIS_HOMEWORK_ASSISTANT_CONTENT_SCRIPT__) {
    console.debug("SABİS Öğrenci Yardımcısı içerik betiği zaten aktif.");
    return;
  }

  async function init() {
    let collectAssignmentsPayloadFromDocument;
    try {
      ({ collectAssignmentsPayloadFromDocument } = await import(
        chrome.runtime.getURL("src/homework/shared/collector.js")
      ));
    } catch (error) {
      console.error(
        "SABİS Öğrenci Yardımcısı toplayıcı modülü yüklenemedi.",
        error
      );
      return;
    }

    window.__SABIS_HOMEWORK_ASSISTANT_CONTENT_SCRIPT__ = true;

    function collectAssignmentsPayload() {
      return collectAssignmentsPayloadFromDocument(
        document,
        window.location.href
      );
    }

    async function collectAssignmentsWithRetries({
      timeoutMs = 8000,
      delayMs = 400
    } = {}) {
      const deadline = Date.now() + timeoutMs;
      let payload = collectAssignmentsPayload();

      while (
        (!payload?.assignments || payload.assignments.length === 0) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        payload = collectAssignmentsPayload();
      }

      return payload;
    }

    function exposeApi() {
      window.__SABIS_HOMEWORK_ASSISTANT__ =
        window.__SABIS_HOMEWORK_ASSISTANT__ || {};
      window.__SABIS_HOMEWORK_ASSISTANT__.collectAssignmentsPayload =
        collectAssignmentsPayload;
    }

    exposeApi();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "COLLECT_ASSIGNMENTS") {
        collectAssignmentsWithRetries()
          .then((payload) => sendResponse(payload))
          .catch((error) =>
            sendResponse({
              assignments: [],
              collectedAt: new Date().toISOString(),
              sourceUrl: window.location.href,
              metadata: {
                error: error instanceof Error ? error.message : String(error)
              }
            })
          );
        return true;
      }
    });

    // Sayfa yüklendiğinde otomatik olarak verileri çek ve background'a bildir
    // Bu sayede kullanıcı SABIS'e her girdiğinde veriler otomatik güncellenir
    setTimeout(async () => {
      try {
        const payload = await collectAssignmentsWithRetries({ timeoutMs: 5000, delayMs: 300 });
        if (payload?.assignments?.length) {
          // Background script'e güncel verileri bildir
          chrome.runtime.sendMessage({
            type: "AUTO_UPDATE_ASSIGNMENTS",
            payload
          }).catch(() => {
            // Hata olursa sessizce geç
          });
        }
      } catch {
        // Otomatik güncelleme başarısız olursa sessizce geç
      }
    }, 2000); // Sayfa tam yüklendikten 2 saniye sonra çalıştır
  }

  init();
})();
