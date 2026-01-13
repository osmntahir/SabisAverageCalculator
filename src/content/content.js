chrome.storage.local.get('extensionEnabled', function (data) {
  // Toggle kapalıysa hiçbir işlem yapma
  if (!data.extensionEnabled) {
    return;
  }

  // Sınıf ortalamalarını saklamak için global nesne
  const classAverages = {};

  /**
   * URL'den yıl ve dönem bilgisini parse et
   * URL formatı: /Ders/2025/1 (yıl/dönem)
   * Dönem: 1=Güz, 2=Bahar, 3=Yaz
   */
  function getAcademicPeriod() {
    const match = window.location.pathname.match(/\/Ders\/(\d{4})\/(\d)/);
    if (match) {
      return {
        year: parseInt(match[1]),
        semester: parseInt(match[2]) // 1=Güz, 2=Bahar, 3=Yaz
      };
    }
    return null;
  }

  /**
   * Final başarı şartı kuralının aktif olup olmadığını kontrol et
   * Kural: 2025-2026 Güz (yıl=2025, dönem=1) ve sonrası için geçerli
   */
  function isFinalPassRuleActive() {
    // URL simülasyonu yapıldığı için localhost'ta da period kontrolü yapılmalı
    // window.location.pathname test sayfalarında history.pushState ile değiştiriliyor

    const period = getAcademicPeriod();
    if (!period) return false; // Dönem bilgisi bulunamazsa kuralı uygulama

    // 2025 yılı Güz (1) dönemi ve sonrası için aktif
    if (period.year > 2025) return true;
    if (period.year === 2025 && period.semester >= 1) return true;

    return false;
  }

  /**
   * Sınıf ortalamasını SABIS'ten çeker
   * @param {number} dersGrupId - Ders grup ID'si
   * @returns {Promise<number|null>} - Sınıf ortalaması veya null
   */
  async function fetchClassAverage(dersGrupId) {
    try {
      // Verification Token'ı bul
      let token = null;

      // 1. Hidden input'lardan ara
      const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
      if (tokenInput) {
        token = tokenInput.value;
      }

      // 2. Script içinden regex ile ara (Kullanıcının HTML yapısında gettoken fonksiyonu var)
      if (!token) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent.includes('__RequestVerificationToken')) {
            const match = script.textContent.match(/value="([^"]+)"/);
            if (match) {
              token = match[1];
              break;
            }
          }
        }
      }



      const commonHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest' // jQuery .load() behavior
      };

      let bodyData = `dersGrupId=${dersGrupId}`;
      if (token) {
        bodyData += `&__RequestVerificationToken=${encodeURIComponent(token)}`;
      }

      // 1. Önce /Grup/Notlar endpoint'ini dene (Başarı Notları)
      try {

        const notlarResponse = await fetch('/Grup/Notlar', {
          method: 'POST',
          headers: commonHeaders,
          body: bodyData,
          credentials: 'include'
        });



        if (notlarResponse.ok) {
          const html = await notlarResponse.text();

          // Eğer login sayfasına yönlendirdiyse (html içinde login form varsa)
          if (html.includes('Login') || html.includes('Giriş Yap')) {
            // Oturum düşmüş
          } else {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Tablo satırlarını tara
            const rows = doc.querySelectorAll('tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              if (cells.length < 2) continue;

              const rowText = row.textContent.toLowerCase().trim();

              // "Ortalama", "Başarı", "Yıl Sonu"
              if (rowText.includes('ortalama') || rowText.includes('başarı') || rowText.includes('sonu')) {

                // Hücreleri tersten tara (sağdaki değer genelde sonuçtur)
                for (let i = cells.length - 1; i >= 0; i--) {
                  const text = cells[i].textContent.trim();
                  const value = parseFloat(text.replace(',', '.'));

                  // NOT: Eğer değer "AA" gibi bir harf notuysa parseFloat NaN döner
                  // Biz sadece sayısal ortalamayı arıyoruz
                  if (!isNaN(value) && value >= 0 && value <= 100) {
                    if (rowText.includes('genel') || rowText.includes('başarı') || rowText.includes('yıl sonu')) {
                      return value;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // Hata oluştu
      }

      // 2. Eğer yukarıdan sonuç çıkmazsa /Grup/SinifOrtalama dene
      // Kullanıcının attığı link yapısı: /Ders/Grup/743430#Ortalama -> /Grup/SinifOrtalama endpointini çağırıyor
      const response = await fetch('/Grup/SinifOrtalama', {
        method: 'POST',
        headers: commonHeaders,
        body: bodyData,
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Doğrudan "Genel Ortalama" veya "Sınıf Ortalaması" etiketine sahip hücreyi bul
      const allCells = doc.querySelectorAll('td');
      const rows = doc.querySelectorAll('tr');

      for (let i = 0; i < allCells.length; i++) {
        const text = allCells[i].textContent.trim().toLowerCase();

        // "Genel", "Ortalama", "Sınıf" kelimelerini ara
        if (text.includes('sınıf ort') || text.includes('genel') || text.includes('ortalama')) {
          // Hemen yanındaki veya bir sonraki hücreye bak
          let sibling = allCells[i].nextElementSibling;
          while (sibling) {
            const valText = sibling.textContent.trim();
            const val = parseFloat(valText.replace(',', '.'));
            if (!isNaN(val) && val >= 0 && val <= 100) {
              return val;
            }
            sibling = sibling.nextElementSibling;
          }
        }
      }

      // Fallback: Tablonun son satırındaki son sayısal değeri al
      // Genellikle "Toplam" veya "Ortalama" en alttadır
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const cells = lastRow.querySelectorAll('td');
        for (let i = cells.length - 1; i >= 0; i--) {
          const valText = cells[i].textContent.trim();
          const val = parseFloat(valText.replace(',', '.'));
          if (!isNaN(val) && val >= 0 && val <= 100) {
            return val;
          }
        }
      }

      // Eğer tablo yapısı yoksa, herhangi bir "Sınıf Ortalaması: 45" yazısını ara
      const bodyText = doc.body.textContent;
      const avgMatch = bodyText.match(/(?:Sınıf|Genel)\s*Ortalamas?ı?\s*[:\s]\s*([\d,.]+)/i);
      if (avgMatch) {
        const val = parseFloat(avgMatch[1].replace(',', '.'));
        if (!isNaN(val) && val >= 0 && val <= 100) {
          return val;
        }
      }

      // H5 veya koyu yazılmış bir değer olabilir mi?
      const boldElements = doc.querySelectorAll('b, strong, h1, h2, h3, h4, h5, .font-weight-bold');
      for (const el of boldElements) {
        const txt = el.textContent.trim();
        // sadece sayı ise ve mantıklı bir değese (0-100)
        if (/^\d+([.,]\d+)?$/.test(txt)) {
          const v = parseFloat(txt.replace(',', '.'));
          // Sayfanın başlığında "Sınıf Ortalaması" geçiyorsa ve bu sayı tek başına duruyorsa
          if (v >= 0 && v <= 100 && doc.body.textContent.includes('Ortalama')) {
            // Biraz riskli ama son çare
            // Potansiyel ortalama buraya düşebilir
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Satır bazlı sınıf ortalamalarını SABIS'ten çeker
   * @param {number} dersGrupId - Ders grup ID'si
   * @returns {Promise<Object>} - { 'Vize': 75.5, 'Final': 80.2, ... } formatında
   */
  async function fetchClassAverages(dersGrupId) {
    const result = {};

    try {
      // Verification Token'ı bul
      let token = null;
      const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
      if (tokenInput) token = tokenInput.value;

      const commonHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      };

      let bodyData = `dersGrupId=${dersGrupId}`;
      if (token) bodyData += `&__RequestVerificationToken=${encodeURIComponent(token)}`;

      // /Grup/SinifOrtalama endpoint'ini kullan
      const response = await fetch('/Grup/SinifOrtalama', {
        method: 'POST',
        headers: commonHeaders,
        body: bodyData,
        credentials: 'include'
      });

      if (!response.ok) return result;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Tablo satırlarını tara
      const rows = doc.querySelectorAll('tr');

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        // İlk hücre çalışma tipi, son hücre ortalama
        const workTypeText = cells[0]?.textContent.trim() || '';
        const avgText = cells[cells.length - 1]?.textContent.trim() || '';

        // Boş veya özel satırları atla
        const lowerWorkType = workTypeText.toLowerCase();
        if (!workTypeText ||
          lowerWorkType.includes('başarı') ||
          lowerWorkType.includes('genel') ||
          lowerWorkType.includes('toplam')) {
          continue;
        }

        // Ortalama değerini parse et
        const avgValue = parseFloat(avgText.replace(',', '.'));

        if (!isNaN(avgValue) && avgValue >= 0 && avgValue <= 100) {
          // Çalışma tipini normalize et ve ekle
          const normalizedKey = normalizeWorkType(workTypeText);
          result[normalizedKey] = avgValue;
        }
      }

      return result;
    } catch (error) {
      return result;
    }
  }

  /**
   * Çalışma tipini normalize et (eşleştirme için)
   * Numara varsa korur: "1. Kısa Sınav" → "kisa_1"
   */
  function normalizeWorkType(type) {
    const lower = type.toLowerCase().trim();

    // Başındaki numarayı çıkar (örn: "1. ", "2.  ")
    const numberMatch = lower.match(/^(\d+)\.\s*/);
    const number = numberMatch ? numberMatch[1] : null;
    const cleanType = lower.replace(/^\d+\.\s*/, '').trim();

    let baseType = '';

    // Vize / Arasınav
    if (cleanType.includes('vize') || cleanType.includes('ara sınav') || cleanType.includes('arasınav')) {
      baseType = 'vize';
    }
    // Final
    else if (cleanType.includes('final')) {
      baseType = 'final';
    }
    // Ödev
    else if (cleanType.includes('ödev')) {
      baseType = 'odev';
    }
    // Proje / Tasarım
    else if (cleanType.includes('proje') || cleanType.includes('tasarım')) {
      baseType = 'proje';
    }
    // Performans / Seminer
    else if (cleanType.includes('performans') || cleanType.includes('seminer')) {
      baseType = 'performans';
    }
    // Kısa Sınav / Quiz
    else if (cleanType.includes('kısa') || cleanType.includes('quiz')) {
      baseType = 'kisa';
    }
    // Bütünleme
    else if (cleanType.includes('bütünleme')) {
      baseType = 'butunleme';
    }
    else {
      baseType = cleanType;
    }

    // Numara varsa ekle
    return number ? `${baseType}_${number}` : baseType;
  }

  /**
   * URL'den veya sayfadan dersGrupId çıkar
   */
  function getDersGrupIdFromUrl() {
    // URL formatı: /Ders/Grup/714520
    const match = window.location.pathname.match(/\/Ders\/Grup\/(\d+)/);
    if (match) return parseInt(match[1]);

    // Alternatif: Sayfadaki JavaScript'ten
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      const idMatch = content.match(/dersGrupId[:\s]+(\d+)/);
      if (idMatch) return parseInt(idMatch[1]);
    }

    return null;
  }

  // Sayfadaki tüm "ders kartlarını" seçiyoruz
  const lessonCards = document.querySelectorAll('.card-custom.card-stretch');

  // Her kart için işlemler
  lessonCards.forEach((card) => {
    const gradeTable = card.querySelector('table');
    if (!gradeTable) return;

    // === KART LAYOUT DÜZENLEMESİ (Buton hizalama için) ===
    // Kartın kendisini flex container yap
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.height = '100%';

    // Card-body'yi esnet (butonun en alta gitmesi için)
    const cardBody = card.querySelector('.card-body');
    if (cardBody) {
      cardBody.style.display = 'flex';
      cardBody.style.flexDirection = 'column';
      cardBody.style.flexGrow = '1';
    }

    // === TABLO BAŞLIKLARINA YENİ SÜTUNLAR EKLE ===
    const headerRow = gradeTable.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('.ext-header')) {
      // Mevcut başlıkları daralt
      const ths = headerRow.querySelectorAll('th');
      if (ths.length >= 3) {
        ths[0].style.width = '45px'; // Oran
        ths[1].style.width = 'auto'; // Çalışma Tipi
        ths[2].style.width = '45px'; // Not
      }

      // Başarı Notu sütunu
      const bNotuHeader = document.createElement('th');
      bNotuHeader.className = 'ext-header text-right';
      bNotuHeader.textContent = 'B.Notu';
      bNotuHeader.title = 'Başarı Notu (Not × Oran / 100)';
      bNotuHeader.style.cssText = 'width: 50px; font-size: 13px; font-weight: 700; cursor: help; color: #4b5563;';
      headerRow.appendChild(bNotuHeader);

      // Sınıf Ortalaması sütunu
      const sOrtHeader = document.createElement('th');
      sOrtHeader.className = 'ext-header text-right';
      sOrtHeader.textContent = 'S.Ort.';
      sOrtHeader.title = 'Sınıf Ortalaması';
      sOrtHeader.style.cssText = 'width: 50px; font-size: 13px; font-weight: 700; cursor: help; color: #4b5563;';
      headerRow.appendChild(sOrtHeader);
    }

    // Tablodaki satırları al
    const gradeRows = gradeTable.querySelectorAll('tbody tr');

    // Her satıra yeni hücreler ekle ve input oluştur
    gradeRows.forEach((row) => {
      // Sütun kontrolü (En az 3 sütun olmalı: Oran, Tip, Not)
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      // Ortalama veya Başarı Notu satırını atla
      const secondCellText = cells[1]?.textContent.trim().toLowerCase() || '';
      if (secondCellText.includes('ortalama') || secondCellText.includes('başarı notu')) {
        // Bu satırlara da boş hücreler ekle ki sütun sayısı uyuşsun
        if (!row.querySelector('.ext-cell')) {
          const emptyCell1 = document.createElement('td');
          emptyCell1.className = 'ext-cell';
          row.appendChild(emptyCell1);
          const emptyCell2 = document.createElement('td');
          emptyCell2.className = 'ext-cell';
          row.appendChild(emptyCell2);
        }
        return;
      }

      // Not hücresi (3. sütun, index 2)
      const gradeCell = cells[2];

      // Eğer hücrede bir input varsa zaten eklenmiştir, geç
      if (gradeCell.querySelector('input')) {
        // Ama yeni sütunlar eklenmemiş olabilir, kontrol et
      }

      // Hücre boşsa input oluştur
      if (!gradeCell.textContent.trim() && !gradeCell.querySelector('input')) {
        gradeCell.innerHTML = `
          <input 
            type="number"
            min="0"
            max="100" 
            class="grade-input"
            style="
              width: 50px;
              height: 26px;
              text-align: right;
              border: 1.5px solid #e4e6ef;
              border-radius: 6px;
              padding: 2px 6px;
              font-size: 12px;
              color: #3F4254;
              background-color: #ffffff;
              transition: all 0.2s ease;
              -moz-appearance: textfield;
              outline: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            "
          >
        `;

        const input = gradeCell.querySelector('.grade-input');
        input.style.cssText += `-webkit-appearance: textfield; margin: 0;`;
      }

      // === YENİ SÜTUNLAR EKLE ===
      if (!row.querySelector('.ext-cell')) {
        // Başarı Notu hücresi
        const bNotuCell = document.createElement('td');
        bNotuCell.className = 'ext-cell text-right b-notu-cell';
        bNotuCell.style.cssText = 'font-weight: 600; color: #3b82f6; font-size: 12px;';
        bNotuCell.textContent = '-';
        row.appendChild(bNotuCell);

        // Sınıf Ortalaması hücresi
        const sOrtCell = document.createElement('td');
        sOrtCell.className = 'ext-cell text-right s-ort-cell';
        sOrtCell.style.cssText = 'color: #64748b; font-size: 12px;';
        sOrtCell.textContent = '⏳'; // Yükleniyor
        row.appendChild(sOrtCell);
      }
    });

    // Hover ve focus efektleri için stil ekle (bir kere)
    if (!document.getElementById('grade-input-style')) {
      const style = document.createElement('style');
      style.id = 'grade-input-style';
      style.textContent = `
        .grade-input::-webkit-inner-spin-button,
        .grade-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .grade-input:hover {
          border-color: #b5b5c3;
          box-shadow: 0 3px 6px rgba(54, 153, 255, 0.1);
        }
        .grade-input:focus {
          border-color: #3699ff;
          border-width: 2px;
          box-shadow: 0 4px 8px rgba(54, 153, 255, 0.15);
        }
        .ext-header:hover {
          background: rgba(59, 130, 246, 0.1);
        }
      `;
      document.head.appendChild(style);
    }

    // Not giriş kutularını dinleyerek ortalamayı ve başarı notlarını güncelleyen fonksiyon
    const updateAverageGrade = () => {
      const displayAverageGrade = calculateDisplayAverageGrade(gradeTable);
      const colorScore = calculateColorScore(displayAverageGrade, gradeTable);

      // Ortalama satırı var mı kontrol et, yoksa ekle
      let averageGradeRow = gradeTable.querySelector('.average-grade-row');
      if (!averageGradeRow) {
        averageGradeRow = document.createElement('tr');
        averageGradeRow.classList.add('average-grade-row');
        gradeTable.querySelector('tbody').appendChild(averageGradeRow);
      }

      // Ortalama satırını güncelle (5 sütun için) - Her zaman sayı göster
      averageGradeRow.innerHTML = `
        <td></td>
        <td class="font-weight-bold">Ortalama</td>
        <td class="text-right font-weight-bold">
          <span style="color: ${getColorForGrade(colorScore)}; font-weight: bold">
            ${displayAverageGrade.toFixed(2)}
          </span>
        </td>
        <td class="ext-cell"></td>
        <td class="ext-cell"></td>
      `;

      // === BAŞARI NOTLARINI GÜNCELLE ===
      const rows = gradeTable.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        // Özel satırları atla
        if (row.classList.contains('average-grade-row') || row.classList.contains('grade-calc-row')) return;

        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;

        // Ortalama veya Başarı Notu satırını atla
        const secondCellText = cells[1]?.textContent.trim().toLowerCase() || '';
        if (secondCellText.includes('ortalama') || secondCellText.includes('başarı notu')) return;

        // Oran (1. sütun)
        const oranText = cells[0].textContent.trim().replace(',', '.');
        const oran = parseFloat(oranText);

        // Not (3. sütun)
        const notCell = cells[2];
        const notInput = notCell.querySelector('.grade-input');
        let notText = notInput ? notInput.value.trim() : notCell.textContent.trim();
        notText = notText.replace(',', '.');
        const not = parseFloat(notText);

        // Başarı Notu (4. sütun)
        const bNotuCell = cells[3];
        if (bNotuCell && bNotuCell.classList.contains('b-notu-cell')) {
          if (!isNaN(oran) && !isNaN(not)) {
            const bNotu = (not * oran) / 100;
            bNotuCell.textContent = bNotu.toFixed(2);
            bNotuCell.style.setProperty('font-weight', '700', 'important');
            bNotuCell.style.setProperty('color', '#3b82f6', 'important'); // Mavi
            bNotuCell.style.setProperty('font-size', '13px', 'important');
          } else {
            bNotuCell.textContent = '-';
            bNotuCell.style.color = '#94a3b8';
            bNotuCell.style.fontWeight = 'normal';
            bNotuCell.style.fontSize = '12px';
          }
        }
      });
    };

    // Tüm inputları seç
    const gradeInputs = gradeTable.querySelectorAll('.grade-input');

    // Her inputun değişiminde ortalamayı güncelle
    gradeInputs.forEach((input) => {
      // Sadece sayı, nokta ve virgüle izin ver
      input.addEventListener('keydown', (e) => {
        // İzin verilen tuşlar
        const allowedKeys = [
          'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
          'Home', 'End'
        ];

        // Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
          return;
        }

        // İzin verilen tuşlar
        if (allowedKeys.includes(e.key)) return;

        // Sayılar (0-9)
        if (/^[0-9]$/.test(e.key)) return;

        // Nokta veya virgül (sadece bir tane olabilir)
        if (e.key === '.' || e.key === ',') {
          // Zaten nokta veya virgül varsa engelle
          if (e.target.value.includes('.') || e.target.value.includes(',')) {
            e.preventDefault();
            return;
          }
          return;
        }

        // Diğer her şeyi engelle
        e.preventDefault();
      });

      // Sadece 0-100 ve ondalık sayı girişine izin ver (virgülü noktaya çevir)
      input.addEventListener('input', (e) => {
        // Virgül girildiyse '.' yap
        if (e.target.value.includes(',')) {
          e.target.value = e.target.value.replace(',', '.');
        }
        // Değer numeric değilse veya boşsa hemen güncelle
        if (isNaN(e.target.value) || e.target.value === '') {
          // e.target.value = ''; // Geçersizse input'u boş bırak (Kullanıcı silerken sorun olmasın)
          updateAverageGrade();
          return;
        }
        // 0-100 arası clamp - ANINDA ENGELLE
        let val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          if (val < 0) e.target.value = 0;
          if (val > 100) e.target.value = 100;
        }

        updateAverageGrade();
      });

      // Blur'da (focustan çıkınca) değeri düzelt
      input.addEventListener('blur', (e) => {
        if (e.target.value === '') return;

        let val = parseFloat(e.target.value.replace(',', '.'));
        if (isNaN(val)) {
          e.target.value = '';
          return;
        }

        // 0-100 arası clamp ve input'a yaz
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        e.target.value = val;

        updateAverageGrade();
      });
    });

    // Sayfa yüklendiğinde ilk hesaplama
    updateAverageGrade();

    // === SAYFA YÜKLENİRKEN OTOMATİK SINIF ORTALAMASI ÇEK ===
    // dersGrupId'yi bul (addGradeCalculatorButton'daki mantığın kopyası)
    let dersGrupId = null;
    const cardHtml = card.innerHTML;

    // Pattern X: dersDetay(743430, 0) veya grupDetay(743430)
    const patternX = /(?:dersDetay|grupDetay)\s*\(\s*(\d+)/;
    const matchX = cardHtml.match(patternX);
    if (matchX) dersGrupId = parseInt(matchX[1]);

    // Pattern 2: /Grup/123456 (Linklerde)
    if (!dersGrupId) {
      const pattern2 = /\/Grup\/(\d+)/;
      const match2 = cardHtml.match(pattern2);
      if (match2) dersGrupId = parseInt(match2[1]);
    }

    // URL'den kontrol
    if (!dersGrupId) {
      dersGrupId = getDersGrupIdFromUrl();
    }

    // Sınıf ortalamalarını arka planda çek (SATIR BAZLI)
    if (dersGrupId) {
      fetchClassAverages(dersGrupId).then((averagesMap) => {
        // Cache'e genel ortalamayı da kaydet (popup için)
        if (Object.keys(averagesMap).length > 0) {
          // Genel ortalamayı hesapla (varsa)
          const values = Object.values(averagesMap);
          const generalAvg = values.reduce((a, b) => a + b, 0) / values.length;
          classAverages[dersGrupId] = generalAvg;
        }

        // Her satır için eşleşen ortalamayı bul
        const rows = gradeTable.querySelectorAll('tbody tr');

        // Her çalışma tipi için sayaç (1. Kısa Sınav, 2. Kısa Sınav ayrımı için)
        const typeCounters = {};

        rows.forEach((row) => {
          // Özel satırları atla
          if (row.classList.contains('average-grade-row') || row.classList.contains('grade-calc-row')) return;

          const cells = row.querySelectorAll('td');
          if (cells.length < 5) return;

          // Çalışma tipi (2. sütun)
          const workTypeCell = cells[1];
          const workTypeText = workTypeCell?.textContent.trim() || '';

          // Ortalama veya Başarı Notu satırını atla
          const lowerText = workTypeText.toLowerCase();
          if (lowerText.includes('ortalama') || lowerText.includes('başarı notu')) return;

          // Çalışma tipinin base halini al (numara olmadan)
          const cleanWorkType = workTypeText.toLowerCase().replace(/^\d+\.\s*/, '').trim();

          // Bu tip için sayaç artır
          if (!typeCounters[cleanWorkType]) {
            typeCounters[cleanWorkType] = 1;
          } else {
            typeCounters[cleanWorkType]++;
          }

          // Numara dahil normalize et
          const normalizedType = normalizeWorkType(workTypeText);

          // S.Ort. hücresi (5. sütun, index 4)
          const sOrtCell = cells[4];
          if (!sOrtCell || !sOrtCell.classList.contains('s-ort-cell')) return;

          // Eşleşen ortalamayı bul
          let matchedAvg = null;

          // 1. Tam eşleşme dene (numara dahil: kisa_1, kisa_2)
          if (averagesMap[normalizedType] !== undefined) {
            matchedAvg = averagesMap[normalizedType];
          }
          // 2. Sayaç ile eşleşme dene
          else {
            const baseType = normalizedType.replace(/_\d+$/, ''); // kisa_1 → kisa
            const counter = typeCounters[cleanWorkType];
            const keyWithCounter = `${baseType}_${counter}`;

            if (averagesMap[keyWithCounter] !== undefined) {
              matchedAvg = averagesMap[keyWithCounter];
            }
            // 3. Numarasız eşleşme (tek bir tane varsa)
            else if (averagesMap[baseType] !== undefined) {
              matchedAvg = averagesMap[baseType];
            }
          }

          // Hücreyi güncelle
          if (matchedAvg !== null) {
            sOrtCell.textContent = matchedAvg.toFixed(2);
            // Tüm stilleri !important ile zorla
            sOrtCell.style.setProperty('color', '#34d399', 'important');
            sOrtCell.style.setProperty('font-weight', '700', 'important');
            sOrtCell.style.setProperty('font-size', '13px', 'important');
          } else {
            sOrtCell.textContent = '-';
            sOrtCell.style.color = '#94a3b8';
            sOrtCell.style.fontWeight = 'normal';
            sOrtCell.style.fontSize = '12px';
          }
        });
      }).catch(() => {
        // Hata durumunda tüm hücreleri - yap
        const sOrtCells = gradeTable.querySelectorAll('.s-ort-cell');
        sOrtCells.forEach((cell) => {
          cell.textContent = '-';
          cell.style.color = '#94a3b8';
        });
      });
    } else {
      // dersGrupId bulunamadıysa
      const sOrtCells = gradeTable.querySelectorAll('.s-ort-cell');
      sOrtCells.forEach((cell) => {
        cell.textContent = '-';
        cell.style.color = '#94a3b8';
      });
    }

    // "Muhtemel Harf Notu Hesapla" butonunu ekle
    addGradeCalculatorButton(card, gradeTable);
  });

  /**
   * Her ders kartına "Muhtemel Harf Notu Hesapla" butonu ekler
   */
  async function addGradeCalculatorButton(card, gradeTable) {
    // Buton zaten varsa ekleme
    if (card.querySelector('.grade-calc-btn')) return;

    // --- AÇIKLANMIŞ HARF NOTU KONTROLÜ ---
    // Tabloda "Başarı Notu" satırı var mı ve dolu mu?
    let isGradeAnnounced = false;
    const rows = gradeTable.querySelectorAll('tbody tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;

      const typeText = cells[1].textContent.trim().toLowerCase();
      if (typeText.includes('başarı notu')) {
        // Not sütunu (genelde 3. sütun, ama bizim eklediğimiz sütunlarla değişebilir, 
        // ancak orijinal tabloda 3. sütundur. Bizim kodumuz sonradan sütun ekliyor.
        // Bu fonksiyon sayfa yüklendiğinde çalıştığı için henüz eklememiş olabiliriz.
        // Garanti olsun diye son hücreye bakalım veya 3. hücreye.
        // Orijinal HTML'de: Oran | Tip | Not
        // Eğer hücrede harf varsa (AA, BA, FF, YT, YZ vb.)
        const gradeText = cells[2]?.textContent.trim();
        if (gradeText && gradeText.length > 0 && gradeText.length <= 3 && isNaN(parseFloat(gradeText))) {
          // Harf notu var demektir (Sayı değilse ve kısa ise)
          isGradeAnnounced = true;
        }
        break;
      }
    }

    // Eğer harf notu açıklanmışsa, ayarı kontrol et
    if (isGradeAnnounced) {
      const settings = await chrome.storage.sync.get({ showCalculatorAnnounced: false });
      if (!settings.showCalculatorAnnounced) {
        return; // Ayar kapalıysa butonu ekleme
      }
    }
    // -------------------------------------

    // Ders adını bul
    // Yeni yapı: .text-dark.font-weight-bolder.font-size-h5
    const courseNameEl = card.querySelector('.card-title a')
      || card.querySelector('.card-title')
      || card.querySelector('.font-weight-bolder.text-hover-primary')
      || card.querySelector('a.font-size-h5');
    const courseName = courseNameEl ? courseNameEl.textContent.trim() : 'Ders';

    // dersGrupId'yi bul
    let dersGrupId = null;

    // 1. Kart HTML'ini string olarak alıp regex ile ID ara
    const cardHtml = card.innerHTML;

    // Pattern X: dersDetay(743430, 0) veya grupDetay(743430) (Kullanıcının HTML yapısı)
    // Bu en öncelikli pattern olmalı çünkü kullanıcının HTML'inde bu var
    if (!dersGrupId) {
      const patternX = /(?:dersDetay|grupDetay)\s*\(\s*(\d+)/;
      const matchX = cardHtml.match(patternX);
      if (matchX) {
        dersGrupId = parseInt(matchX[1]);
      }
    }

    // Pattern 1: dersGrupId: 123456 (Javascript nesnesi içinde)
    if (!dersGrupId) {
      const pattern1 = /dersGrupId\s*[:=]\s*(\d+)/;
      const match1 = cardHtml.match(pattern1);
      if (match1) dersGrupId = parseInt(match1[1]);
    }

    // Pattern 2: /Grup/123456 (Linklerde)
    if (!dersGrupId) {
      const pattern2 = /\/Grup\/(\d+)/;
      const match2 = cardHtml.match(pattern2);
      if (match2) dersGrupId = parseInt(match2[1]);
    }

    // Pattern 3: .load('.../123456'...) (AJAX çağrılarında)
    if (!dersGrupId) {
      const pattern3 = /\.load\(['"].*?\/(\d+)['"]\)/;
      const match3 = cardHtml.match(pattern3);
      if (match3) dersGrupId = parseInt(match3[1]);
    }

    // 2. Halen bulunamadıysa SAYFADAKİ SCRIPT TAGLERİNİ TARA (Global değişken olabilir)
    if (!dersGrupId) {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        // var dersGrupId = 123; veya let dersGrupId = 123;
        const scriptMatch = content.match(/dersGrupId\s*=\s*(\d+)/);
        if (scriptMatch) {
          dersGrupId = parseInt(scriptMatch[1]);
          break;
        }

        // { dersGrupId: 123 }
        const objMatch = content.match(/dersGrupId\s*:\s*(\d+)/);
        if (objMatch) {
          dersGrupId = parseInt(objMatch[1]);
          break;
        }
      }
    }

    // 3. Halen bulunamadıysa URL'yi kontrol et
    if (!dersGrupId) {
      dersGrupId = getDersGrupIdFromUrl();
    }

    // Buton oluştur
    const button = document.createElement('button');
    button.className = 'grade-calc-btn';
    button.innerHTML = '📊 Muhtemel Harf Notu Hesapla';
    button.title = 'Muhtemel Harf Notu Hesapla';
    button.style.cssText = `
      display: block;
      width: 100%;
      margin: 8px 0 4px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
      text-align: center;
    `;

    // Hover efekti
    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#3b82f6';
    });

    // Tıklama olayı - sınıf ortalamasını çekip popup göster
    button.addEventListener('click', async () => {
      const studentScore = calculateDisplayAverageGrade(gradeTable);

      if (!window.GradeCalculator) {
        alert('Harf notu hesaplayıcı yüklenemedi.');
        return;
      }

      // Loading durumu göster
      const originalText = button.innerHTML;
      button.innerHTML = '⏳ Sınıf ortalaması çekiliyor...';
      button.disabled = true;
      button.style.opacity = '0.7';

      try {
        // Sınıf ortalamasını çek
        let classAvg = null;
        if (dersGrupId) {
          // Önce cache'den kontrol et
          if (classAverages[dersGrupId] !== undefined) {
            classAvg = classAverages[dersGrupId];
          } else {
            classAvg = await fetchClassAverage(dersGrupId);
            classAverages[dersGrupId] = classAvg; // Cache'e kaydet
          }
        }

        // === FİNAL/BÜTÜNLEME BİLGİSİNİ HAZIRLA ===
        // Bütünleme varsa onu kullan, yoksa Final'i kullan
        let finalInfo = null;
        const isRuleActive = isFinalPassRuleActive();

        if (isRuleActive) {
          const rows = gradeTable.querySelectorAll('tbody tr');
          let finalNote = null;
          let butunlemeNote = null;

          // Önce tüm notları topla
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const workType = cells[1]?.textContent.trim().toLowerCase() || '';
            const notCell = cells[2];
            const notInput = notCell.querySelector('.grade-input');
            let notText = notInput ? notInput.value.trim() : notCell.textContent.trim();
            notText = notText.replace(',', '.');
            const noteValue = parseFloat(notText);

            if (workType.includes('bütünleme')) {
              if (!isNaN(noteValue)) butunlemeNote = noteValue;
            } else if (workType.includes('final')) {
              if (!isNaN(noteValue)) finalNote = noteValue;
            }
          });

          // Bütünleme varsa onu kullan, yoksa Final
          const effectiveNote = butunlemeNote !== null ? butunlemeNote : finalNote;
          const noteType = butunlemeNote !== null ? 'Bütünleme' : 'Final';

          if (effectiveNote !== null) {
            finalInfo = {
              note: effectiveNote,
              noteType: noteType,
              isFailed: effectiveNote < 40,
              isRuleActive: true
            };
          }
        }

        // Popup'ı göster (sınıf ortalaması ve final bilgisi varsa kullan)
        window.GradeCalculator.showGradePopup(courseName, studentScore, classAvg, finalInfo);
      } catch (error) {
        window.GradeCalculator.showGradePopup(courseName, studentScore, null, null);
      } finally {
        // Butonu eski haline getir
        button.innerHTML = originalText;
        button.disabled = false;
        button.style.opacity = '1';
      }
    });

    // Butonu kartın body kısmına ekle (tablonun dışına - hizalama için)
    const cardBodyForButton = card.querySelector('.card-body');
    if (cardBodyForButton) {
      // Buton wrapper oluştur - margin-top: auto ile en alta it
      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'grade-calc-wrapper';
      buttonWrapper.style.cssText = 'margin-top: auto; padding: 8px 0 4px;';
      buttonWrapper.appendChild(button);
      cardBodyForButton.appendChild(buttonWrapper);
    } else {
      // Fallback: Tablonun sonuna ekle (eski yöntem)
      const tbody = gradeTable.querySelector('tbody');
      if (tbody) {
        const buttonRow = document.createElement('tr');
        buttonRow.className = 'grade-calc-row';
        const buttonCell = document.createElement('td');
        buttonCell.colSpan = 5;
        buttonCell.style.cssText = 'padding: 8px 4px 4px; border: none;';
        buttonCell.appendChild(button);
        buttonRow.appendChild(buttonCell);
        tbody.appendChild(buttonRow);
      }
    }
  }

  /**
   * NOT: Bu fonksiyon "Bütünleme" satırı varsa Final'i hesaba katmıyor.
   *      Eğer Bütünleme satırı yoksa eski usül Final devreye giriyor.
   */
  function calculateDisplayAverageGrade(gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');

    // 1) Tabloda Bütünleme satırı var mı kontrol edelim
    let hasButunleme = false;
    gradeRows.forEach((row) => {
      const calismaTipiCell = row.querySelector('td:nth-child(2)');
      if (!calismaTipiCell) return;
      // Küçük-büyük harf farkını kapatmak için toLowerCase kullandık
      if (calismaTipiCell.textContent.trim().toLowerCase() === 'bütünleme') {
        hasButunleme = true;
      }
    });

    let totalGrade = 0;
    let totalWeight = 0;

    gradeRows.forEach((row) => {
      const calismaTipiCell = row.querySelector('td:nth-child(2)');
      if (!calismaTipiCell) return;

      const calismaTipi = calismaTipiCell.textContent.trim().toLowerCase();

      // Bütünleme varsa "final" satırını atla
      if (hasButunleme && calismaTipi.includes('final')) {
        return;
      }

      const ratioText = row.querySelector('td:first-child').textContent.trim();
      const ratioValue = parseFloat(ratioText.replace(',', '.'));

      // Notu input’tan veya hücredeki metinden al
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;
      const gradeCell = cells[2];

      const gradeInput = gradeCell.querySelector('.grade-input');

      let gradeText = gradeInput
        ? gradeInput.value.trim()
        : gradeCell.textContent.trim();
      gradeText = gradeText.replace(',', '.');

      const grade = parseFloat(gradeText);

      // Geçerli not + oran varsa hesapla
      if (!isNaN(grade) && !isNaN(ratioValue)) {
        totalGrade += (grade * ratioValue) / 100;
        totalWeight += ratioValue;
      }
    });

    // Bölme hatasına karşı kontrol
    return totalWeight > 0 ? totalGrade : 0;
  }

  function calculateColorScore(calculatedGrade, gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');

    // Aynı şekilde Bütünleme kontrolü yapalım
    let hasButunleme = false;
    gradeRows.forEach((row) => {
      const calismaTipiCell = row.querySelector('td:nth-child(2)');
      if (!calismaTipiCell) return;
      if (calismaTipiCell.textContent.trim().toLowerCase() === 'bütünleme') {
        hasButunleme = true;
      }
    });

    let totalWeight = 0;
    gradeRows.forEach((row) => {
      const calismaTipiCell = row.querySelector('td:nth-child(2)');
      if (!calismaTipiCell) return;

      const calismaTipi = calismaTipiCell.textContent.trim().toLowerCase();
      if (hasButunleme && calismaTipi.includes('final')) {
        return;
      }

      const ratioText = row.querySelector('td:first-child').textContent.trim();
      const ratio = parseFloat(ratioText.replace(',', '.'));

      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;
      const gradeCell = cells[2];

      const gradeInput = gradeCell.querySelector('.grade-input');
      let gradeText = gradeInput
        ? gradeInput.value.trim()
        : gradeCell.textContent.trim();
      gradeText = gradeText.replace(',', '.');

      if (!isNaN(parseFloat(gradeText)) && !isNaN(ratio)) {
        totalWeight += ratio;
      }
    });

    // colorScore = (ortalama * 100) / toplamOran
    return totalWeight > 0 ? (calculatedGrade * 100) / totalWeight : 0;
  }

  // Ortalamaya göre rengi dön
  function getColorForGrade(colorScore) {
    if (colorScore > 75) {
      return 'green';
    } else if (colorScore >= 55) {
      return 'blue';
    } else {
      return 'red';
    }
  }
});
