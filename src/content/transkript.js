chrome.storage.local.get('extensionEnabled', ({ extensionEnabled }) => {
  if (extensionEnabled === false) return;

  /* ─── Sabit tablolar ─── */
  const gradeCoeffs = {
    AA: 4,  BA: 3.5, BB: 3,  CB: 2.5,
    CC: 2,  DC: 1.5, DD: 1,  FD: 0.5,
    FF: 0,  DZ: 0,   GR: 0,
    YT: null, YZ: null, MU: null, E: null
  };
  const gradeList = ['', ...Object.keys(gradeCoeffs)];

  /* ─── Yardımcılar ─── */
  const num = s => parseFloat(String(s).replace(',', '.')) || 0;
  const fmt = v => v.toFixed(2).replace('.', ',');
  const txt = el => (el?.textContent || '').trim().toUpperCase();
  const vld = g  => gradeCoeffs.hasOwnProperty(g);

  /* ► Yıldızlı satır mı?  (Ortalamaya girmez) */
  const isExcluded = row =>
    !!row.querySelector('td:first-child span')?.textContent.includes('*');

  /* ─── Sayfa kurulumu ─── */
  document.querySelectorAll('.card.card-custom.gutter-b.card-stretch')
    .forEach(setupCard);
  recalcAll();

  /* ╔══════════════════════  Fonksiyonlar  ══════════════════════╗ */

  function setupCard(card) {
    addAktsToggleButton(card);

    card.querySelectorAll('tbody tr').forEach(row => {
      const tdGrade = row.children[2];
      const tdAkts  = row.children[3];
      if (!tdGrade || !tdAkts) return;

      /* Harf-notu combobox’u (yıldızlı satır da combobox alır) */
      const initGrade = vld(txt(tdGrade)) ? txt(tdGrade) : '';
      tdGrade.textContent = '';
      tdGrade.appendChild(createGradeSelect(initGrade));

      /* AKTS hücresi (orijinal + custom) */
      tdAkts.dataset.original = txt(tdAkts);
      tdAkts.dataset.custom   = '';
      tdAkts.style.cursor = 'pointer';
      tdAkts.style.textAlign = 'center';
      tdAkts.addEventListener('click', () => editAktsPrompt(card, tdAkts));
    });
  }

  /* ── Minimal “AKTS Düzenle” butonu + CSS ── */
  function addAktsToggleButton(card) {
    if (!document.getElementById('akts-toggle-style')) injectCSS();

    const header = card.querySelector('.card-header');
    const btn = document.createElement('button');
    btn.className = 'akts-toggle-btn';
    btn.dataset.state = 'off';
    btn.innerHTML = '❌ AKTS Düzenle';
    btn.title = 'AKTS Düzenle: Kapalı';
    header.appendChild(btn);

    btn.addEventListener('click', () => {
      const on = btn.dataset.state === 'off';
      btn.dataset.state = on ? 'on' : 'off';
      btn.classList.toggle('on', on);
      btn.innerHTML = `${on ? '✅' : '❌'} AKTS Düzenle`;
      btn.title = `AKTS Düzenle: ${on ? 'Açık' : 'Kapalı'}`;

      if (on) addMinusPlusControls(card);
      else { removeMinusPlusControls(card); resetAktsToOriginal(card); }
      recalcAll();
    });
  }

  /* ── CSS Enjeksiyonu ── */
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'akts-toggle-style';
    style.textContent = `
      .akts-toggle-btn{
        padding:2px 8px;font-size:.80rem;line-height:1.2;border:none;
        border-radius:4px;background:#424242;color:#fff;cursor:pointer;
        display:flex;gap:4px;align-items:center;transition:.2s;align-self:center}
      .akts-toggle-btn.on{background:#1E88E5;}
      .akts-toggle-btn:hover{filter:brightness(1.1);}
      .akts-wrapper{display:flex;align-items:center;justify-content:center;gap:4px}
      .akts-btn{
        width:18px;height:18px;padding:0;border:none;border-radius:2px;
        background:#616161;color:#fff;font-size:12px;line-height:1;cursor:pointer}
      .akts-btn:hover{filter:brightness(1.2);}
    `;
    document.head.appendChild(style);
  }

  /* − / + kontrollerini ekle (yıldızlı satırlar hariç) */
  function addMinusPlusControls(card) {
    card.querySelectorAll('tbody tr').forEach(row => {
      if (isExcluded(row)) return;                       // ortalamaya girmez
      const td = row.children[3];
      if (!td || td.querySelector('.akts-wrapper')) return;

      const value = td.dataset.custom || td.dataset.original;
      const wrap = document.createElement('div');
      wrap.className = 'akts-wrapper';

      const dec  = stepBtn('−');
      const span = document.createElement('span');
      span.className = 'akts-val';
      span.textContent = value;
      const inc  = stepBtn('+');

      wrap.append(dec, span, inc);
      td.textContent = '';
      td.appendChild(wrap);

      const adjust = d => {
        const v = Math.max(0, parseInt(span.textContent, 10) + d);
        span.textContent = v;
        td.dataset.custom = String(v);
        td.style.color = '#1976d2';
        recalcAll();
      };
      dec.addEventListener('click', e => { e.stopPropagation(); adjust(-1); });
      inc.addEventListener('click', e => { e.stopPropagation(); adjust(1); });
    });
  }
  const stepBtn = t => Object.assign(document.createElement('button'),
                                     {className:'akts-btn',textContent:t});

  /* − / + kontrollerini kaldır */
  function removeMinusPlusControls(card) {
    card.querySelectorAll('.akts-wrapper').forEach(wrap => {
      const td = wrap.parentElement;
      const v  = td.dataset.custom || td.dataset.original;
      td.textContent = v;
      td.style.color = td.dataset.custom ? '#1976d2' : '';
    });
  }

  /* Hücre tıklamasıyla prompt (isteğe bağlı) */
  function editAktsPrompt(card, td) {
    if (card.querySelector('.akts-toggle-btn')?.dataset.state !== 'on') return;

    const cur = td.dataset.custom || td.dataset.original;
    const inp = prompt('Yeni AKTS değeri (pozitif tam sayı):', cur);
    if (inp === null) return;

    const v = Math.max(0, Math.round(Number(inp)));
    if (!Number.isFinite(v)) { alert('Geçersiz AKTS değeri!'); return; }

    td.dataset.custom = String(v);
    td.style.color = '#1976d2';

    const span = td.querySelector('.akts-val');
    span ? span.textContent = v : td.textContent = v;

    recalcAll();
  }

  /* AKTS’leri orijinale döndür */
  function resetAktsToOriginal(card) {
    card.querySelectorAll('tbody tr').forEach(row => {
      const td = row.children[3];
      td.dataset.custom = '';
      td.style.color = '';
      const span = td.querySelector('.akts-val');
      span ? span.textContent = td.dataset.original
           : td.textContent   = td.dataset.original;
    });
  }

  /* Harf-notu select + renk */
  function createGradeSelect(initial) {
    const sel = document.createElement('select');
    sel.className = 'grade-select';
    sel.dataset.initial = initial;
    Object.assign(sel.style, {
      width:'100%',border:'none',background:'transparent',outline:'none',
      display:'block',textAlign:'center',textAlignLast:'center',
      margin:'0 auto',cursor:'pointer'
    });

    gradeList.forEach(g => {
      const o = new Option(g, g);
      if (g === initial) o.selected = true;
      sel.appendChild(o);
    });

    tintSelect(sel);
    sel.addEventListener('change', () => { tintSelect(sel); recalcAll(); });
    return sel;
  }
  function tintSelect(sel) {
    const init = sel.dataset.initial || '';
    const cur  = sel.value.toUpperCase();
    sel.style.color =
      (cur === '' || cur === init) ? '' :
      (init === '' ? '#2e7d32' : '#fbc02d');
  }

  /* Tek dönem hesapla (yıldızlıları atla) */
  function calcSemester(card) {
    let akts = 0, weight = 0;
    card.querySelectorAll('tbody tr').forEach(row => {
      if (isExcluded(row)) return;                 // dahil etme
      const td = row.children[3];
      const a  = num(td.dataset.custom || td.dataset.original);

      const letter = row.querySelector('select.grade-select')?.value.toUpperCase();
      const coeff  = gradeCoeffs[letter];
      if (!vld(letter) || coeff === null) return;

      akts   += a;
      weight += coeff * a;
    });
    return { akts, weight };
  }

  /* Tüm kartlar + genel hesap */
  function recalcAll() {
    let cumA = 0, cumW = 0;
    document.querySelectorAll('.card.card-custom.gutter-b.card-stretch')
      .forEach(card => {
        const { akts:a, weight:w } = calcSemester(card);
        updateFooter(card, 'DÖNEM SONU', a, w, a ? w / a : 0);

        cumA += a; cumW += w;
        updateFooter(card, 'GENEL', cumA, cumW, cumA ? cumW / cumA : 0);
      });
  }

  /* Footer satırını güncelle */
  function updateFooter(card, label, akts, weight, avg) {
    const row = [...card.querySelectorAll('tfoot tr')]
      .find(r => txt(r.cells[0]).startsWith(label));
    if (!row) return;
    row.cells[1].textContent = akts;
    row.cells[2].textContent = fmt(weight);
    row.cells[3].textContent = fmt(avg);
  }
});
