// ============================================
// IJARACHI SAHIFASI — LOGIKA (RASM YUKLASH TUZATILDI)
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let ijarachiList = [];
let jarimaMap = {};
let currentKv = null;
let currentDetailId = null; 
let listMonthsStart = 0;

const OYLAR = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktyabr","Noyabr","Dekabr"];

// ---------- YORDAMCHI ----------

function pulFmt(n) { return Math.round(Number(n)).toLocaleString('uz-UZ') + " so'm"; }
function formatSana(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function hisoblaKechganOylar(kelganSanaStr, bugunObj) {
  const kelgan = new Date(kelganSanaStr); kelgan.setHours(0,0,0,0);
  const bugun = new Date(bugunObj); bugun.setHours(0,0,0,0);
  if (bugun < kelgan) return 0;
  let yilFarq = bugun.getFullYear() - kelgan.getFullYear();
  let oyFarq = bugun.getMonth() - kelgan.getMonth();
  let kunFarq = bugun.getDate() - kelgan.getDate();
  let jamiOy = (yilFarq * 12) + oyFarq;
  if (kunFarq >= 0) jamiOy += 1;
  return jamiOy > 0 ? jamiOy : 0;
}

// ---------- RASM YUKLASH FUNKSIYASI ----------

async function rasmYukla(file, ijarachiId, turi) {
  if (!file) return null;
  
  // Fayl nomini unikal qilish (masalan: 1234_profil.jpg)
  const ext = file.name.split('.').pop();
  const nom = `${ijarachiId}_${turi}_${Date.now()}.${ext}`;
  
  // Supabase Storage'ga yuklash
  const { data, error } = await supabaseClient.storage.from('rasmlar').upload(nom, file, {
    cacheControl: '3600',
    upsert: true
  });

  if (error) {
    console.error("Rasm yuklashda xatolik:", error);
    alert("Rasm yuklanmadi: " + error.message);
    return null;
  }

  // Public URL olish
  const { data: urlData } = supabaseClient.storage.from('rasmlar').getPublicUrl(nom);
  return urlData.publicUrl;
}

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  if (!kvId) return;

  const { data: kvData } = await supabaseClient.from('kv').select('*').eq('id', kvId).single();
  if (kvData) {
    currentKv = kvData;
    document.getElementById('kvTitle').textContent = kvData.nomi + " — Ijarachilar";
  }

  const { data: ijData } = await supabaseClient.from('ijarachi').select('*').eq('id_kv', kvId);
  ijarachiList = ijData || [];

  const { data: jarimaData } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (jarimaData || []).forEach(j => {
    jarimaMap[j.ijarachi_id] = { qiymat: j.qiymat || 0, navbat_soni: j.navbat_soni || 0 };
  });

  await renderKartalar();
}

// ---------- KARTALARNI RENDER QILISH ----------

async function renderKartalar() {
  const container = document.getElementById('listContainer');
  if (ijarachiList.length === 0) {
    container.innerHTML = '<p class="loading">Ijarachi yo\'q.</p>';
    return;
  }

  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const joriyOy = bugun.getMonth();
  const joriyYil = bugun.getFullYear();

  let oylar = [];
  for (let i = -1; i <= 1; i++) {
    let m = joriyOy + i;
    let y = joriyYil;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    oylar.push({ yil: y, oyIndeks: m, nomi: OYLAR[m] });
  }

  if (listMonthsStart !== 0) {
    let siljish = listMonthsStart * 2;
    oylar = [];
    for (let i = -1 + siljish; i <= 1 + siljish; i++) {
      let m = joriyOy + i;
      let y = joriyYil;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      oylar.push({ yil: y, oyIndeks: m, nomi: OYLAR[m] });
    }
  }

  let ijarachilarBilanRang = [];

  for (const ij of ijarachiList) {
    const kelganOylar = hisoblaKechganOylar(ij.kelgan_kun, bugun);
    const umumiyKerak = kelganOylar * Number(ij.oylik_tolov);
    
    const { data: tolovlar } = await supabaseClient.from('tolov_tarixi_yangi').select('summa').eq('ijarachi_id', ij.id);
    const umumiyTolangan = (tolovlar || []).reduce((sum, t) => sum + Number(t.summa), 0);

    let rang = 'yashil';
    if ((jarimaMap[ij.id]?.qiymat || 0) >= 10) {
      rang = 'qora';
    } else if (umumiyTolangan < umumiyKerak) {
      rang = 'qizil';
    }

    ijarachilarBilanRang.push({ ij, rang, umumiyTolangan, umumiyKerak });
  }

  const tartib = { qora: 1, qizil: 2, sariq: 3, yashil: 4 };
  ijarachilarBilanRang.sort((a, b) => tartib[a.rang] - tartib[b.rang]);

  let html = '';
  let joriyGuruh = '';

  for (const item of ijarachilarBilanRang) {
    const ij = item.ij;
    const rang = item.rang;

    if (joriyGuruh !== rang) {
      joriyGuruh = rang;
      const nomlar = { qora: '⚫ Qora — qoidabuzar', qizil: '🔴 Qizil — qarzdor', sariq: '🟡 Sariq — to\'lov vaqti yaqin', yashil: '🟢 Yashil — hammasi joyida' };
      html += `<div class="group-title ${rang}">${nomlar[rang]}</div>`;
    }

    const kelganSana = new Date(ij.kelgan_kun);
    const kelganYil = kelganSana.getFullYear();
    const kelganOy = kelganSana.getMonth();

    let oylarHtml = '';
    let qoldiqTolov = item.umumiyTolangan;

    for (const o of oylar) {
      let holatClass = 'gray';
      let holatText = '⚪ -';
      
      if (o.yil < kelganYil || (o.yil === kelganYil && o.oyIndeks < kelganOy)) {
        holatClass = 'green';
        holatText = '✅ -';
      } 
      else {
        if (qoldiqTolov >= Number(ij.oylik_tolov)) {
          holatClass = 'green';
          holatText = '✅ To\'liq';
          qoldiqTolov -= Number(ij.oylik_tolov);
        } else if (qoldiqTolov > 0) {
          if (o.yil > joriyYil || (o.yil === joriyYil && o.oyIndeks > joriyOy)) {
             holatClass = 'gray';
          } else {
             holatClass = 'red';
          }
          holatText = `${holatClass === 'gray' ? '⚪' : '❌'} ${pulFmt(Number(ij.oylik_tolov) - qoldiqTolov)}`;
          qoldiqTolov = 0;
        } else {
          if (o.yil > joriyYil || (o.yil === joriyYil && o.oyIndeks > joriyOy)) {
             holatClass = 'gray';
             holatText = `⚪ ${pulFmt(ij.oylik_tolov)}`;
          } else {
             holatClass = 'red';
             holatText = `❌ ${pulFmt(ij.oylik_tolov)}`;
          }
        }
      }

      oylarHtml += `<div class="month-btn ${holatClass}">
        <div style="font-size:10px;opacity:0.8">${o.nomi}</div>
        <div>${holatText}</div>
      </div>`;
    }

    const jBall = jarimaMap[ij.id]?.qiymat || 0;
    let jarimaHtml = '';
    if (jBall > 0) {
      jarimaHtml = `
        <div style="display:flex; align-items:center; margin-top:4px;">
          <span class="jarima-badge ${jBall >= 10 ? 'danger' : ''}">⚠️ Jarima: ${jBall} ball</span>
          <button class="btn-add-jarima" onclick="event.stopPropagation(); qoshimchaJarima('${ij.id}')">+1</button>
        </div>
      `;
    } else {
      jarimaHtml = `
        <div style="display:flex; align-items:center; margin-top:4px;">
          <span style="font-size:12px;color:#6b7280;">Jarimasiz</span>
          <button class="btn-add-jarima" onclick="event.stopPropagation(); qoshimchaJarima('${ij.id}')">+1</button>
        </div>
      `;
    }

    html += `
      <div class="ij-card-compact ${rang}" onclick="showDetail('${ij.id}')">
        <div class="ij-header-row">
          ${ij.profil_rasm ? `<img src="${ij.profil_rasm}" class="ij-avatar-small">` : `<div class="ij-avatar-small">👤</div>`}
          <div class="ij-name-box">
            <h3>${ij.ismi}</h3>
            <div class="ij-sub-text">🚪 ${ij.hona} | 🛏️ ${ij.karavat}</div>
            ${jarimaHtml}
          </div>
        </div>
        <div class="months-slider">
          <button class="month-arrow" onclick="event.stopPropagation(); slideOylar(-1)">◀</button>
          ${oylarHtml}
          <button class="month-arrow" onclick="event.stopPropagation(); slideOylar(1)">▶</button>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

window.slideOylar = function(yonalish) {
  listMonthsStart += yonalish;
  if (listMonthsStart > 5) listMonthsStart = 5;
  if (listMonthsStart < -5) listMonthsStart = -5;
  renderKartalar();
};

window.qoshimchaJarima = async function(id) {
  if (!confirm("Ushbu ijarachiga 1 ball jarima yozmoqchimisiz?")) return;
  const mavjud = jarimaMap[id] || { qiymat: 0, navbat_soni: 0 };
  await supabaseClient.from('jarima').upsert({
    ijarachi_id: id, qiymat: (mavjud.qiymat || 0) + 1, navbat_soni: mavjud.navbat_soni || 0, yangilangan_vaqt: new Date().toISOString()
  }, { onConflict: 'ijarachi_id' });
  malumotYukla();
};

// ---------- DETAIL MODAL ----------

async function showDetail(id) {
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;
  currentDetailId = id;

  const bugun = new Date(); const joriyOy = bugun.getMonth(); const joriyYil = bugun.getFullYear();
  const kelganSana = new Date(ij.kelgan_kun); const kelganYil = kelganSana.getFullYear(); const kelganOy = kelganSana.getMonth();

  const kelganOylar = hisoblaKechganOylar(ij.kelgan_kun, bugun);
  const umumiyKerak = kelganOylar * Number(ij.oylik_tolov);
  const { data: tolovlar } = await supabaseClient.from('tolov_tarixi_yangi').select('summa').eq('ijarachi_id', ij.id);
  const umumiyTolangan = (tolovlar || []).reduce((sum, t) => sum + Number(t.summa), 0);

  let tolovlarHtml = '';
  let qoldiqTolov = umumiyTolangan;

  for (let i = -1; i <= 1; i++) {
    let m = joriyOy + i; let y = joriyYil;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    
    const oyNomi = OYLAR[m];
    let status = '⚪ Kutilmoqda'; let color = '#6b7280';

    if (y < kelganYil || (y === kelganYil && m < kelganOy)) {
       status = '✅ Talab qilinmaydi'; color = '#9ca3af';
    } else {
       if (qoldiqTolov >= Number(ij.oylik_tolov)) {
           status = '✅ To\'liq'; color = '#16a34a'; qoldiqTolov -= Number(ij.oylik_tolov);
       } else if (qoldiqTolov > 0) {
           status = `❌ Qoldiq: ${pulFmt(Number(ij.oylik_tolov) - qoldiqTolov)}`; color = '#dc2626'; qoldiqTolov = 0;
       } else {
           status = `❌ Qoldiq: ${pulFmt(ij.oylik_tolov)}`; color = '#dc2626';
       }
    }
    tolovlarHtml += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><span>${oyNomi} ${y}</span><span style="color:${color};font-weight:600">${status}</span></div>`;
  }

  const jBall = jarimaMap[ij.id]?.qiymat || 0;

  document.getElementById('dTitle').textContent = ij.ismi;
  document.getElementById('dBody').innerHTML = `
    <div style="display:flex; gap:16px; margin-bottom:16px;">
      ${ij.profil_rasm ? `<img src="${ij.profil_rasm}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">` : `<div style="width:80px;height:80px;border-radius:50%;background:#e5e7eb;display:flex;justify-content:center;align-items:center;font-size:30px;">👤</div>`}
      <div>
        <p><b>Kelgan:</b> ${formatSana(ij.kelgan_kun)}</p>
        <p><b>Oylik:</b> ${pulFmt(ij.oylik_tolov)}</p>
        <p><b>Jarima bali:</b> <span style="color:${jBall >= 10 ? '#dc2626' : '#f59e0b'};font-weight:700;">${jBall} ball</span></p>
        <p><b>Umumiy kerak:</b> ${pulFmt(umumiyKerak)}</p>
        <p><b>Umumiy to'langan:</b> <span style="color:#16a34a">${pulFmt(umumiyTolangan)}</span></p>
      </div>
    </div>
    <p>📞 ${ij.nomer || 'Yo\'q'}</p>
    <h4 style="margin-top:16px; margin-bottom:8px; border-bottom:2px solid #2563eb; padding-bottom:4px;">Oylar kesimida to'lov</h4>
    ${tolovlarHtml}
  `;
  document.getElementById('detailModal').classList.add('active');
}

document.getElementById('dBtnDoc').onclick = () => xujjatlar(currentDetailId);
document.getElementById('dBtnPay').onclick = () => tolovOch(currentDetailId);
document.getElementById('dBtnEdit').onclick = () => tahrirla(currentDetailId);
document.getElementById('dBtnDelete').onclick = () => ochirishIjarachi(currentDetailId);
document.getElementById('dBtnTelegram').onclick = () => {
  const ij = ijarachiList.find(i => i.id === currentDetailId);
  if (ij && ij.telegram) window.open(`https://t.me/${ij.telegram.replace('@', '')}`, '_blank');
  else alert("Telegram nik kiritilmagan!");
};

// ---------- TO'LOV QILISH ----------

function tolovOch(id) {
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;
  document.getElementById('detailModal').classList.remove('active');
  document.getElementById('payId').value = id;
  document.getElementById('payName').textContent = ij.ismi;
  document.getElementById('paySumma').value = ij.oylik_tolov;
  document.getElementById('payIzoh').value = '';

  const select = document.getElementById('payOy');
  select.innerHTML = '';
  const kelgan = new Date(ij.kelgan_kun);
  const bugun = new Date();
  let curYil = kelgan.getFullYear(); let curOy = kelgan.getMonth();
  const oxirgiOy = bugun.getMonth() + 2; const oxirgiYil = bugun.getFullYear();

  while (curYil < oxirgiYil || (curYil === oxirgiYil && curOy <= oxirgiOy)) {
    const opt = document.createElement('option');
    opt.value = `${curYil}-${curOy}`;
    opt.textContent = `${OYLAR[curOy]} ${curYil}`;
    select.appendChild(opt);
    curOy++;
    if (curOy > 11) { curOy = 0; curYil++; }
  }
  document.getElementById('payModal').classList.add('active');
}

document.getElementById('paySave').onclick = async () => {
  const id = document.getElementById('payId').value;
  const summa = parseFloat(document.getElementById('paySumma').value);
  const izoh = document.getElementById('payIzoh').value.trim();
  const oyVal = document.getElementById('payOy').value;

  if (!summa || summa <= 0) { alert("Summani kiriting!"); return; }
  if (!oyVal) { alert("To'lov oyini tanlang!"); return; }

  const [yil, oyIndeks] = oyVal.split('-').map(Number);
  const oyNomi = OYLAR[oyIndeks];
  const yakuniyIzoh = izoh ? `${oyNomi} oyi uchun. ${izoh}` : `${oyNomi} oyi uchun`;

  const { error } = await supabaseClient.from('tolov_tarixi_yangi').insert({ ijarachi_id: id, summa, izoh: yakuniyIzoh });
  if (error) { alert("Xatolik: " + error.message); return; }
  document.getElementById('payModal').classList.remove('active');
  malumotYukla();
};

// ---------- RASM YUKLASH VA IJARACHI SAQLASH ----------

document.getElementById('btnAdd').addEventListener('click', () => {
  if (currentKv && ijarachiList.length >= currentKv.sigimi) { alert("Sig'im to'lgan!"); return; }
  document.getElementById('formTitle').textContent = "Ijarachi qo'shish";
  ['fId', 'fIsmi', 'fNomer', 'fTelegram', 'fOylik', 'fKelgan', 'fHona', 'fKaravat', 'fJarima'].forEach(id => document.getElementById(id).value = '');
  ['fProfil', 'fPasOld', 'fPasOrqa'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('formModal').classList.add('active');
});

function tahrirla(id) {
  document.getElementById('detailModal').classList.remove('active');
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;
  document.getElementById('formTitle').textContent = "Ijarachi tahrirlash";
  document.getElementById('fId').value = ij.id;
  document.getElementById('fIsmi').value = ij.ismi;
  document.getElementById('fNomer').value = ij.nomer || '';
  document.getElementById('fTelegram').value = ij.telegram || '';
  document.getElementById('fOylik').value = ij.oylik_tolov;
  document.getElementById('fKelgan').value = ij.kelgan_kun;
  document.getElementById('fHona').value = ij.hona;
  document.getElementById('fKaravat').value = ij.karavat;
  document.getElementById('fJarima').value = jarimaMap[ij.id]?.qiymat || 0;
  ['fProfil', 'fPasOld', 'fPasOrqa'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('formModal').classList.add('active');
}

document.getElementById('formSave').addEventListener('click', async () => {
  const id = document.getElementById('fId').value;
  const jarimaBall = parseInt(document.getElementById('fJarima').value) || 0;
  
  const ismi = document.getElementById('fIsmi').value.trim();
  if (!ismi) { alert("Ismni kiriting!"); return; }

  // Tugma loading holatiga o'tadi
  const btn = document.getElementById('formSave');
  btn.textContent = "Saqlanmoqda..."; btn.disabled = true;

  const data = {
    id_kv: kvId,
    ismi: ismi,
    nomer: document.getElementById('fNomer').value.trim() || null,
    telegram: document.getElementById('fTelegram').value.trim() || null,
    oylik_tolov: parseFloat(document.getElementById('fOylik').value) || 0,
    kelgan_kun: document.getElementById('fKelgan').value,
    hona: document.getElementById('fHona').value.trim(),
    karavat: document.getElementById('fKaravat').value.trim()
  };

  let yangiId = id;
  
  if (id) {
    await supabaseClient.from('ijarachi').update(data).eq('id', id);
  } else {
    const { data: yangi, error } = await supabaseClient.from('ijarachi').insert({...data, balans: 0, yangilangan_vaqt: new Date().toISOString()}).select().single();
    if (error) { alert("Xatolik: " + error.message); btn.textContent = "Saqlash"; btn.disabled = false; return; }
    yangiId = yangi.id;
    await supabaseClient.from('jarima').insert({ ijarachi_id: yangiId, qiymat: jarimaBall, navbat_soni: 0 });
  }

  if (id) {
    const mavjud = jarimaMap[id] || { qiymat: 0, navbat_soni: 0 };
    await supabaseClient.from('jarima').upsert({ ijarachi_id: id, qiymat: jarimaBall, navbat_soni: mavjud.navbat_soni || 0, yangilangan_vaqt: new Date().toISOString() }, { onConflict: 'ijarachi_id' });
  }

  // RASMLARNI YUKLASH
  const profilFile = document.getElementById('fProfil').files[0];
  const pasOldFile = document.getElementById('fPasOld').files[0];
  const pasOrqaFile = document.getElementById('fPasOrqa').files[0];

  let yangilanish = {};

  if (profilFile) {
    const url = await rasmYukla(profilFile, yangiId, 'profil');
    if (url) yangilanish.profil_rasm = url;
  }
  if (pasOldFile) {
    const url = await rasmYukla(pasOldFile, yangiId, 'pasport_old');
    if (url) yangilanish.pasport_old = url;
  }
  if (pasOrqaFile) {
    const url = await rasmYukla(pasOrqaFile, yangiId, 'pasport_orqa');
    if (url) yangilanish.pasport_orqa = url;
  }

  if (Object.keys(yangilanish).length > 0) {
    await supabaseClient.from('ijarachi').update(yangilanish).eq('id', yangiId);
  }

  btn.textContent = "Saqlash"; btn.disabled = false;
  document.getElementById('formModal').classList.remove('active');
  malumotYukla();
});

// ---------- QOLGAN FUNKSIYALAR ----------

function ochirishIjarachi(id) {
  document.getElementById('detailModal').classList.remove('active');
  document.getElementById('deleteIjarachiNomi').textContent = ijarachiList.find(i => i.id === id)?.ismi;
  document.getElementById('deleteModal').classList.add('active');
  document.getElementById('deleteConfirm').onclick = async () => {
    await supabaseClient.from('ijarachi').delete().eq('id', id);
    document.getElementById('deleteModal').classList.remove('active');
    malumotYukla();
  };
}

async function xujjatlar(id) {
  document.getElementById('detailModal').classList.remove('active');
  const ij = ijarachiList.find(i => i.id === id);
  document.getElementById('docBody').innerHTML = `
    <div class="doc-item"><h4>Pasport oldi</h4>${ij.pasport_old ? `<img src="${ij.pasport_old}"><a href="${ij.pasport_old}" target="_blank">📥 Yuklab olish</a>` : '<p>Yuklanmagan</p>'}</div>
    <div class="doc-item"><h4>Pasport orqasi</h4>${ij.pasport_orqa ? `<img src="${ij.pasport_orqa}"><a href="${ij.pasport_orqa}" target="_blank">📥 Yuklab olish</a>` : '<p>Yuklanmagan</p>'}</div>
  `;
  document.getElementById('docModal').classList.add('active');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => window.location.href = `${btn.dataset.page}.html?id=${kvId}`);
});

malumotYukla();