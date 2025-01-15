chrome.storage.local.get('extensionEnabled', function (data) {
  // Toggle kapalıysa hiçbir işlem yapma
  if (!data.extensionEnabled) {
    return;
  }

  // Sayfadaki tüm "ders kartlarını" seçiyoruz
  const lessonCards = document.querySelectorAll('.card-custom.card-stretch');

  // Her kart için işlemler
  lessonCards.forEach((card) => {
    // Not tablolarını bul
    const gradeTable = card.querySelector('table');
    if (!gradeTable) return;

    // Tablodaki satırları al
    const gradeRows = gradeTable.querySelectorAll('tbody tr');

    // Boş not hücrelerine input ekle
    gradeRows.forEach((row) => {
      const gradeCell = row.querySelector('.text-right');
      if (!gradeCell) return;

      // Hücre zaten boşsa input oluştur
      if (!gradeCell.textContent.trim()) {
        gradeCell.innerHTML = `
          <input 
            type="number" 
            class="grade-input"
            style="
              width: 60px;
              height: 28px;
              text-align: right;
              border: 1.5px solid #e4e6ef;
              border-radius: 6px;
              padding: 4px 8px;
              font-size: 13px;
              color: #3F4254;
              background-color: #ffffff;
              transition: all 0.2s ease;
              -moz-appearance: textfield;
              outline: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            "
          >
        `;

        // Input elementini seç ve hover/focus stillerini ekle
        const input = gradeCell.querySelector('.grade-input');
        input.style.cssText += `
          -webkit-appearance: textfield;
          margin: 0;
        `;

        // Hover ve focus efektleri için stil ekle
        const style = document.createElement('style');
        style.textContent = `
          .grade-input::-webkit-inner-spin-button,
          .grade-input::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          
          .grade-input:hover {
            border-color: #b5b5c3;
            box-shadow: 0 3px 6px rgba(54, 153, 255, 0.1);
            transform: translateY(-1px);
          }
          
          .grade-input:focus {
            border-color: #3699ff;
            border-width: 2px;
            box-shadow: 0 4px 8px rgba(54, 153, 255, 0.15);
            transform: translateY(-1px);
          }
        `;
        document.head.appendChild(style);
      }
    });

    // Not giriş kutularını dinleyerek ortalamayı güncelleyen fonksiyon
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

      // Ortalama satırını güncelle
      averageGradeRow.innerHTML = `
        <td></td>
        <td class="font-weight-bold">Ortalama</td>
        <td class="text-right font-weight-bold">
          <span style="color: ${getColorForGrade(colorScore)}; font-weight: bold">
            ${displayAverageGrade.toFixed(2)}
          </span>
        </td>
      `;
    };

    // Tüm inputları seç
    const gradeInputs = gradeTable.querySelectorAll('.grade-input');

    // Her inputun değişiminde ortalamayı güncelle
    gradeInputs.forEach((input) => {
      // Sadece 0-100 ve ondalık sayı girişine izin ver (virgülü noktaya çevir)
      input.addEventListener('input', (e) => {
        // Virgül girildiyse '.' yap
        if (e.target.value.includes(',')) {
          e.target.value = e.target.value.replace(',', '.');
        }
        // Değer numeric değilse veya boşsa hemen güncelle
        if (isNaN(e.target.value) || e.target.value === '') {
          e.target.value = ''; // Geçersizse input'u boş bırak
          updateAverageGrade(); // Ortalama hesapla
          return;
        }
        // 0-100 arası clamp
        let val = parseFloat(e.target.value);
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        e.target.value = val;

        updateAverageGrade();
      });
    });

    // Sayfa yüklendiğinde ilk hesaplama
    updateAverageGrade();
  });

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
      const gradeCell = row.querySelector('.text-right');
      if (!gradeCell) return;
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

      const gradeCell = row.querySelector('.text-right');
      if (!gradeCell) return;
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
