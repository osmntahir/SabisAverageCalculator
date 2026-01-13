/**
 * Muhtemel Harf Notu Hesaplayıcı
 * SABİS Not Yardımcısı
 */

// Harf notu tablosu (Mutlak Değerlendirme)
const GRADE_SCALE = [
  { min: 90, max: 100, letter: 'AA', name: 'Pekiyi', coefficient: 4.00 },
  { min: 85, max: 89.99, letter: 'BA', name: 'İyi-Pekiyi', coefficient: 3.50 },
  { min: 80, max: 84.99, letter: 'BB', name: 'İyi', coefficient: 3.00 },
  { min: 75, max: 79.99, letter: 'CB', name: 'Orta-İyi', coefficient: 2.50 },
  { min: 65, max: 74.99, letter: 'CC', name: 'Orta', coefficient: 2.00 },
  { min: 58, max: 64.99, letter: 'DC', name: 'Zayıf-Orta', coefficient: 1.50 },
  { min: 50, max: 57.99, letter: 'DD', name: 'Zayıf', coefficient: 1.00 },
  { min: 40, max: 49.99, letter: 'FD', name: 'Başarısız', coefficient: 0.50 },
  { min: 0, max: 39.99, letter: 'FF', name: 'Başarısız', coefficient: 0.00 }
];

// T-Skoru aralıkları (SAÜ Simülasyonu - "Öğrenci Dostu" Ayarlar)
// Bu aralıklar, Sakarya Üniversitesi'nin bağıl değerlendirme sisteminde
// sıklıkla karşılaşılan not skalasını simüle eder.
const T_SCORE_SCALE = [
  { min: 67, max: 999, letter: 'AA', name: 'Pekiyi', coefficient: 4.00 },
  { min: 62, max: 66.99, letter: 'BA', name: 'İyi-Pekiyi', coefficient: 3.50 },
  { min: 57, max: 61.99, letter: 'BB', name: 'İyi', coefficient: 3.00 },
  { min: 52, max: 56.99, letter: 'CB', name: 'Orta-İyi', coefficient: 2.50 },
  { min: 47, max: 51.99, letter: 'CC', name: 'Orta', coefficient: 2.00 },
  { min: 42, max: 46.99, letter: 'DC', name: 'Zayıf-Orta', coefficient: 1.50 },
  { min: 37, max: 41.99, letter: 'DD', name: 'Zayıf', coefficient: 1.00 },
  { min: 32, max: 36.99, letter: 'FD', name: 'Başarısız', coefficient: 0.50 },
  { min: 0, max: 31.99, letter: 'FF', name: 'Başarısız', coefficient: 0.00 }
];

// Sınıf ortalaması aralıkları
const CLASS_AVERAGE_RANGES = [
  { min: 0, max: 29, label: '0-29' },
  { min: 30, max: 39, label: '30-39' },
  { min: 40, max: 49, label: '40-49' },
  { min: 50, max: 54, label: '50-54' },
  { min: 55, max: 59, label: '55-59' },
  { min: 60, max: 64, label: '60-64' },
  { min: 65, max: 69, label: '65-69' },
  { min: 70, max: 74, label: '70-74' },
  { min: 75, max: 79, label: '75-79' },
  { min: 80, max: 84, label: '80-84' },
  { min: 85, max: 89, label: '85-89' },
  { min: 90, max: 100, label: '90-100' }
];

/**
 * Mutlak değerlendirme ile harf notu hesapla
 */
function getLetterGrade(score) {
  for (const grade of GRADE_SCALE) {
    if (score >= grade.min && score <= grade.max) {
      return grade;
    }
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1]; // FF
}

/**
 * Gelişmiş Bağıl Değerlendirme Algoritması (SABİS Simülasyonu)
 * 
 * Amaç: Gerçek sisteme en yakın ve öğrenci lehine olan sonucu üretmek.
 * 
 * Mantık:
 * 1. Sabit bir Standart Sapma (Sigma = 14.5) kabulü ile T-Skoru hesaplanır.
 *    - Bu değer, ortalamanın üzerindeki başarıyı hızla ödüllendirir.
 *    - 88 not / 57 ortalama örneğinde AA sonucunu (T > 67) garanti eder.
 * 
 * 2. "Maksimum Fayda" Kuralı Uygulanır:
 *    - Hesaplanan Bağıl Not ile Mutlak Not karşılaştırılır.
 *    - Hangisi daha yüksekse (katsayı olarak) o not esas alınır.
 *    - Bu sayede sistem asla mutlak notun altına düşmez ("Çan aşağı çekmez" kuralı).
 */
function getRelativeGrade(studentScore, classAverage) {
  // 1. Mutlak Notu Hesapla
  const mutlakGrade = getLetterGrade(studentScore);

  // 2. Bağıl Notu (T-Skoru ile) Hesapla
  // Standart Sapma (Sigma): 14.5
  // (Ortalama 20'dir ancak öğrenci lehine sonuçlar için 14.5 daha gerçekçidir)
  const estimatedStdDev = 14.5;
  const zScore = (studentScore - classAverage) / estimatedStdDev;
  const tScore = (zScore * 10) + 50;

  let relativeGrade = T_SCORE_SCALE[T_SCORE_SCALE.length - 1]; // Default FF
  for (const grade of T_SCORE_SCALE) {
    if (tScore >= grade.min) {
      relativeGrade = grade;
      break;
    }
  }

  // 3. Maksimum Fayda Kuralı (Hangisi Yüksekse)
  if (relativeGrade.coefficient > mutlakGrade.coefficient) {
    return relativeGrade;
  } else {
    // Eşit veya mutlak daha iyiyse mutlak notu döndür
    return mutlakGrade;
  }
}

/**
 * Senaryoları Hesapla (Dinamik)
 * Kullanıcı isteği: "En iyi, En kötü ve Ara senaryo"
 */
function calculateCurveScenarios(studentScore, knownClassAvg = null) {
  const scenarios = [];

  // Eğer sınıf ortalaması biliniyorsa buna göre sapmalı senaryolar üret
  if (knownClassAvg !== null) {
    // 1. En İyi Senaryo (Hoca ortalamayı düşürürse / Çan dip noktadan uygulanırsa)
    // Genelde hocalar ortalamayı 10-15 puan aşağı çekebilir
    const bestCaseAvg = Math.max(0, knownClassAvg - 12);
    const bestCaseGrade = getRelativeGrade(studentScore, bestCaseAvg);
    scenarios.push({
      title: '🤩 En İyi Senaryo',
      desc: 'Hoca ortalamayı düşürürse',
      avg: bestCaseAvg,
      grade: bestCaseGrade,
      color: '#22c55e', // Green
      icon: '🚀'
    });

    // 2. Olası Senaryo (Mevcut Ortalama)
    // Mevcut verilerle hesaplanan
    const likelyGrade = getRelativeGrade(studentScore, knownClassAvg);
    scenarios.push({
      title: '🤔 Olası Senaryo',
      desc: 'Mevcut ortalama ile',
      avg: knownClassAvg,
      grade: likelyGrade,
      color: '#3b82f6', // Blue
      icon: '📊'
    });

    // 3. En Kötü Senaryo (Hoca ortalamayı yüksek tutarsa / Sert Çan)
    // Ortalamanın biraz daha yüksek kabul edildiği veya mutlak sistemin baskın olduğu durum
    const worstCaseAvg = Math.min(100, knownClassAvg + 8);
    const worstCaseGrade = getRelativeGrade(studentScore, worstCaseAvg);
    scenarios.push({
      title: '😬 En Kötü Senaryo',
      desc: 'Sert değerlendirme',
      avg: worstCaseAvg,
      grade: worstCaseGrade,
      color: '#ef4444', // Red
      icon: '🛡️'
    });

  } else {
    // Sınıf ortalaması bilinmiyorsa genel aralıkları (Düşük, Orta, Yüksek) göster

    // Düşük Ortalama (35-45 arası gibi)
    const lowAvg = 40;
    scenarios.push({
      title: '🤩 Düşük Ortalama',
      desc: 'Sınıf Ort: ~40',
      avg: lowAvg,
      grade: getRelativeGrade(studentScore, lowAvg),
      color: '#22c55e',
      icon: '📉'
    });

    // Orta Ortalama (50-60 arası)
    const midAvg = 55;
    scenarios.push({
      title: '🤔 Orta Ortalama',
      desc: 'Sınıf Ort: ~55',
      avg: midAvg,
      grade: getRelativeGrade(studentScore, midAvg),
      color: '#eab308',
      icon: '➖'
    });

    // Yüksek Ortalama (65-75 arası)
    const highAvg = 70;
    scenarios.push({
      title: '😬 Yüksek Ortalama',
      desc: 'Sınıf Ort: ~70',
      avg: highAvg,
      grade: getRelativeGrade(studentScore, highAvg),
      color: '#ef4444',
      icon: '📈'
    });
  }

  return scenarios;
}

/**
 * Harf notuna göre badge rengi
 */
function getGradeColor(letter) {
  const colors = {
    'AA': { bg: '#22c55e', text: '#ffffff' },
    'BA': { bg: '#84cc16', text: '#ffffff' },
    'BB': { bg: '#a3e635', text: '#1a1a1a' },
    'CB': { bg: '#facc15', text: '#1a1a1a' },
    'CC': { bg: '#fbbf24', text: '#1a1a1a' },
    'DC': { bg: '#f97316', text: '#ffffff' },
    'DD': { bg: '#fb923c', text: '#1a1a1a' },
    'FD': { bg: '#ef4444', text: '#ffffff' },
    'FF': { bg: '#dc2626', text: '#ffffff' }
  };
  return colors[letter] || { bg: '#6b7280', text: '#ffffff' };
}

/**
 * Popup HTML oluştur - Sınıf ortalaması girişi ile
 * @param {string} courseName - Ders adı
 * @param {number} studentScore - Öğrenci ortalaması
 * @param {number|null} knownClassAvg - Bilinen sınıf ortalaması
 * @param {object|null} finalInfo - { note: number, isFailed: boolean, isRuleActive: boolean }
 */
function createGradePopup(courseName, studentScore, knownClassAvg = null, finalInfo = null) {
  const mutlakGrade = getLetterGrade(studentScore);

  // Final < 40 kontrolü - varsa senaryolar FF/FD olacak
  const isFinalFailed = finalInfo && finalInfo.isRuleActive && finalInfo.isFailed;

  // FF mi FD mi karar ver
  let finalFailGrade = 'FF';
  let finalFailCoeff = '0.00';

  if (isFinalFailed) {
    // Öğrencinin potansiyel notunu hesapla
    const potentialGrade = knownClassAvg !== null
      ? getRelativeGrade(studentScore, knownClassAvg)
      : getLetterGrade(studentScore); // Ortalaması yoksa mutlak bak (Garanti not)

    // Eğer potansiyel not FF değilse (yani geçer not veya FD ise) ama finalden kaldıysa -> FD verilir
    if (potentialGrade.letter !== 'FF') {
      finalFailGrade = 'FD';
      finalFailCoeff = '0.50';
    }
  }

  const scenarios = isFinalFailed ? null : calculateCurveScenarios(studentScore, knownClassAvg);

  // Final başarı şartı uyarısı HTML'i
  let finalWarningHtml = '';
  if (isFinalFailed) {
    const examType = finalInfo.noteType || 'Final';
    finalWarningHtml = `
      <div style="
        background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%);
        border: 1px solid #991b1b;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        position: relative;
        overflow: hidden;
      ">
        <!-- Dekoratif Arka Plan -->
        <div style="
          position: absolute;
          top: -20px;
          right: -20px;
          width: 100px;
          height: 100px;
          background: radial-gradient(circle, rgba(220, 38, 38, 0.2) 0%, rgba(220, 38, 38, 0) 70%);
          border-radius: 50%;
          filter: blur(15px);
          z-index: 0;
        "></div>

        <div style="display: flex; align-items: flex-start; gap: 16px; position: relative; z-index: 1;">
          <div style="
            background: rgba(220, 38, 38, 0.2);
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
            border: 1px solid rgba(220, 38, 38, 0.3);
          ">
            ❌
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #fecaca; font-size: 16px; margin-bottom: 4px; letter-spacing: -0.01em;">
              ${examType} Sınavı Başarısız
            </div>
            <div style="color: #fca5a5; font-size: 14px; line-height: 1.5;">
              ${examType} notunuz <strong style="color: #fff; font-weight: 700;">${finalInfo.note}</strong> olduğu için dersten 
              <strong style="color: #fff; font-weight: 700;">${finalFailGrade}</strong> alarak başarısız sayılırsınız.
            </div>
            <div style="
              margin-top: 12px;
              padding-top: 12px; 
              border-top: 1px solid rgba(255,255,255,0.1);
              display: flex;
              align-items: center;
              gap: 8px;
              color: #f87171;
              font-size: 13px;
              font-weight: 500;
            ">
              <span style="font-size: 16px;">💡</span>
              <span>${examType} sınavından en az <strong style="color: #fecaca;">40</strong> puan almanız gerekmektedir.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const popupHtml = `
    <div id="grade-popup-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    ">
      <div id="grade-popup" style="
        background: white;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 100%;
        max-width: 520px;
        margin: 20px;
        position: relative;
        overflow: hidden;
        animation: popupSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <!-- Header -->
        <div style="
          background: #0f172a;
          padding: 24px;
          border-bottom: 1px solid #1e293b;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">DERS</div>
            <button id="close-grade-popup" style="
              background: none;
              border: none;
              color: #94a3b8;
              font-size: 24px;
              cursor: pointer;
              padding: 0;
              line-height: 1;
              transition: color 0.2s;
            ">×</button>
          </div>
          <div style="font-size: 20px; font-weight: 700; color: white;">${courseName}</div>
        </div>

        <!-- Body -->
        <div style="padding: 24px; max-height: 80vh; overflow-y: auto;">
          ${finalWarningHtml}
          
          <!-- Üst Bilgi Kartları -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
            <!-- Öğrenci Notu -->
            <div style="
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
            ">
              <div style="font-size: 13px; color: #64748b; font-weight: 500;">SİZİN NOTUNUZ</div>
              <div style="font-size: 32px; font-weight: 800; color: #334155; margin-top: 4px;">${studentScore.toFixed(2)}</div>
            </div>

            <!-- Sınıf Ortalaması -->
             <div style="
              background: ${knownClassAvg !== null ? '#f0fdf4' : '#fff7ed'};
              border: 1px solid ${knownClassAvg !== null ? '#bbf7d0' : '#fed7aa'};
              border-radius: 12px;
              padding: 16px;
              text-align: center;
            ">
              <div style="font-size: 13px; color: ${knownClassAvg !== null ? '#166534' : '#9a3412'}; font-weight: 500;">SINIF ORTALAMASI</div>
              <div style="font-size: 32px; font-weight: 800; color: ${knownClassAvg !== null ? '#15803d' : '#c2410c'}; margin-top: 4px;">
                ${knownClassAvg !== null ? knownClassAvg.toFixed(2) : '-'}
              </div>
              ${knownClassAvg === null ? '<div style="font-size: 11px; color: #9a3412; margin-top: 4px;">(Bulunamadı)</div>' : ''}
            </div>
          </div>
          
          <!-- Senaryolar Başlık -->
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 4px; display: flex; align-items: center; gap: 8px;">
              📊 ${isFinalFailed ? 'Muhtemel Harf Notu' : 'Olası Senaryolar'}
            </h3>
            <p style="font-size: 13px; color: #64748b; margin: 0;">
              ${isFinalFailed ? 'Final notunun yetersiz olması sebebiyle:' : 'Çan eğrisinin farklı şekillerde uygulanması durumunda olası notlarınız:'}
            </p>
          </div>

          ${isFinalFailed ? `
          
          <!-- Final Başarısız - Sade FF/FD Kartı -->
          <div style="
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 12px;
            margin-bottom: 32px;
          ">
            <div style="
              grid-column: 2;
              background: white;
              border: 1px solid #e2e8f0;
              border-top: 4px solid ${getGradeColor(finalFailGrade).bg};
              border-radius: 12px;
              padding: 16px 12px;
              text-align: center;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            ">
              <div style="font-size: 24px; margin-bottom: 8px;">📛</div>
              
              <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Final Yetersiz
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 12px; height: 30px; display: flex; align-items: center; justify-content: center;">
                Dersten başarısız sayılırsınız
              </div>
              
              <div style="
                background: ${getGradeColor(finalFailGrade).bg};
                color: ${getGradeColor(finalFailGrade).text};
                padding: 8px;
                border-radius: 8px;
                font-weight: 800;
                font-size: 24px;
                line-height: 1;
                margin-bottom: 8px;
                display: inline-block;
                min-width: 60px;
              ">
                ${finalFailGrade}
              </div>
              
              <div style="font-size: 12px; font-weight: 500; color: #64748b;">
                Katsayı: ${finalFailCoeff}
              </div>
            </div>
          </div>
          ` : `
          <!-- 3 Kartlı Senaryo Yapısı -->
          <div style="
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 12px;
            margin-bottom: 32px;
          ">
            ${scenarios.map(s => `
              <div class="scenario-card" style="
                background: white;
                border: 1px solid #e2e8f0;
                border-top: 4px solid ${s.color};
                border-radius: 12px;
                padding: 16px 12px;
                text-align: center;
                transition: all 0.2s ease;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                display: flex;
                flex-direction: column;
                height: 100%;
              ">
                <div style="font-size: 24px; margin-bottom: 8px;">${s.icon}</div>
                <div style="
                  font-size: 13px; 
                  font-weight: 700; 
                  color: #334155; 
                  margin-bottom: 4px;
                  min-height: 38px; /* 2 satır başlık için */
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">${s.title}</div>
                <div style="
                  font-size: 11px; 
                  color: #64748b; 
                  margin-bottom: 12px; 
                  height: 30px; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center;
                ">${s.desc}</div>
                
                <div style="margin-top: auto;">
                  <div style="
                    background: ${getGradeColor(s.grade.letter).bg};
                    color: ${getGradeColor(s.grade.letter).text};
                    padding: 8px;
                    border-radius: 8px;
                    font-weight: 800;
                    font-size: 24px;
                    line-height: 1;
                    margin-bottom: 8px;
                    display: inline-block;
                    min-width: 60px;
                  ">
                    ${s.grade.letter}
                  </div>
                  
                  <div style="font-size: 12px; font-weight: 500; color: #64748b;">
                    Katsayı: ${s.grade.coefficient.toFixed(2)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          `}
          
          <!-- Mutlak Değerlendirme (Referans) -->
          <div style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 20px;">⚖️</div>
              <div>
                <div style="font-size: 13px; font-weight: 600; color: #475569;">Çan Eğrisi Uygulanmazsa</div>
                <div style="font-size: 12px; color: #94a3b8;">Mutlak sistem (Sınıf ortalaması önemsiz)</div>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-weight: 700; color: #334155; font-size: 16px;">${mutlakGrade.letter}</span>
              <span style="font-size: 13px; color: #64748b;">(${mutlakGrade.coefficient.toFixed(2)})</span>
            </div>
          </div>

          <p style="
            margin: 20px 0 0;
            padding: 12px;
            background: #fef3c7;
            border-radius: 8px;
            font-size: 12px;
            color: #92400e;
            text-align: center;
          ">
            ⚠️ Bu hesaplamalar tahmini değerlerdir. Gerçek sonuçlar farklılık gösterebilir.
          </p>
        </div>
      </div>
    </div>
  `;

  return popupHtml;
}

/**
 * Popup'ı göster
 * @param {string} courseName - Ders adı
 * @param {number} studentScore - Öğrenci ortalaması
 * @param {number|null} knownClassAvg - Bilinen sınıf ortalaması (otomatik çekilmiş)
 * @param {object|null} finalInfo - { note: number, isFailed: boolean, isRuleActive: boolean }
 */
function showGradePopup(courseName, studentScore, knownClassAvg = null, finalInfo = null) {
  // Mevcut popup varsa kaldır
  const existingPopup = document.getElementById('grade-popup-overlay');
  if (existingPopup) existingPopup.remove();

  // Yeni popup ekle (sınıf ortalaması ve final bilgisi varsa kullan)
  const popupContainer = document.createElement('div');
  popupContainer.innerHTML = createGradePopup(courseName, studentScore, knownClassAvg, finalInfo);
  document.body.appendChild(popupContainer.firstElementChild);

  // Kapatma butonuna event listener
  document.getElementById('close-grade-popup').addEventListener('click', () => {
    document.getElementById('grade-popup-overlay').remove();
  });

  // Overlay'e tıklanınca kapat
  document.getElementById('grade-popup-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'grade-popup-overlay') {
      e.target.remove();
    }
  });

  // ESC tuşu ile kapat
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      const popup = document.getElementById('grade-popup-overlay');
      if (popup) popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Export (content.js'den erişim için global'e ekle)
window.GradeCalculator = {
  getLetterGrade,
  getRelativeGrade,
  calculateCurveScenarios,
  showGradePopup,
  getGradeColor
};
