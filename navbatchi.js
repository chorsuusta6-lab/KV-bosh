// ============================================
// NAVBATCHI SAHIFASI — LOGIKA (TO'G'RILANGAN)
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let vazifalar = [];
let ijarachiList = [];
let jarimaMap = {}; 
let faolNavbatchilar = []; 
let avvalgiNavbatchilar = [];

// ---------- TABLARNI ALMASHTIRISH ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const contentId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
    document.getElementById(contentId).classList.add('active');
  });
});

// ---------- MA'LUMOT YUKLASH ----------
async function malumotYukla() {
  const { data: v } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = v || [];

  let q = supabaseClient.from('ijarachi').select('*');
  if (kvId) q = q.eq('id_kv', kvId);
  const { data: ij } = await q.order('ismi');
  ijarachiList = ij || [];

  const { data: j } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (j || []).forEach(x => {
    jarimaMap[x.ijarachi_id] = { qiymat: x.qiymat || 0, navbat_soni: x.navbat_soni || 0 };
  });

  const bugun = new Date().toISOString().slice(0,10);
  const { data: tarix } = await supabaseClient.from('navbatchi_tarix')
    .select('*, vazifa:vazifa_id(nomi), ijarachi:ijarachi_id(ismi)')
    .order('sana', { ascending: false });

  const barchaTarix = tarix || [];
  faolNavbatchilar = barchaTarix.filter(t => t.sana === bugun);
  
  const avvalgiSanalar = [...new Set(barchaTarix.filter(t => t.sana < bugun).map(t => t.sana))];
  const engYaqinAvvalgiSana = avvalgiSanalar.length > 0 ? avvalgiSanalar[0] : null;
  avvalgiNavbatchilar = engYaqinAvvalgiSana ? barchaTarix.filter(t => t.sana === engYaqinAvvalgiSana) : [];

  renderFaolNavbatchilar();
  renderAvvalgiNavbatchilar();
  ijarachiRoyxatRender();
  vazifaRender();
}

// ---------- FAOL NAVBATCHILAR RENDER ----------
function renderFaolNavbatchilar() {
  const group = document.getElementById('faolNavbatchilarGroup');
  const list = document.getElementById('faolNavbatchilarList');

  if (faolNavbatchilar.length === 0) {
    group.style.display = 'none';
    return;
  }
  group.style.display = 'block';

  const guruhlangan = {};
  faolNavbatchilar.forEach(n => {
    if (!guruhlangan[n.ijarachi_id]) {
      guruhlangan[n.ijarachi_id] = { ism: n.ijarachi.ismi, vazifalar: [], idlar: [], holat: n.holat };
    }
    guruhlangan[n.ijarachi_id].vazifalar.push(n.vazifa.nomi);
    guruhlangan[n.ijarachi_id].idlar.push(n.id);
  });

  list.innerHTML = Object.values(guruhlangan).map(g => {
    let tugmalarYokiHolat = '';
    if (g.holat === 'kutilmoqda') {
      tugmalarYokiHolat = `
        <div class="faol-actions">
          <button class="btn-sm btn-qisman" onclick="holatBelgila('${g.idlar.join(",")}', 'qisman')">⚠️ Qisman</button>
          <button class="btn-sm btn-bajardi" onclick="holatBelgila('${g.idlar.join(",")}', 'bajardi')">✅ Bajardi</button>
          <button class="btn-sm btn-bajarmadi" onclick="holatBelgila('${g.idlar.join(",")}', 'bajarmadi')">❌ Bajarmadi</button>
        </div>
      `;
    } else {
      let badgeText = '';
      let badgeClass = '';
      if (g.holat === 'bajardi') { badgeText = '✅ Bajardi'; badgeClass = 'bajardi'; }
      else if (g.holat === 'bajarmadi') { badgeText = '❌ Bajarmadi'; badgeClass = 'bajarmadi'; }
      else if (g.holat === 'qisman') { badgeText = '⚠️ Qisman'; badgeClass = 'qisman'; }

      tugmalarYokiHolat = `<span class="holat-badge ${badgeClass}">${badgeText}</span>`;
    }

    return `
      <div class="ij-item faol ${g.holat !== 'kutilmoqda' ? g.holat : ''}" style="flex-wrap: wrap;">
        <div class="ij-avatar">👤</div>
        <div class="ij-info" style="flex: 1 1 100%;">
          <h3>${g.ism}</h3>
          <div class="navbat-soni" style="color: #d97706; font-size:13px;">📋 ${g.vazifalar.join(', ')}</div>
        </div>
        ${tugmalarYokiHolat}
      </div>
    `;
  }).join('');
}

// ---------- AVVALGI NAVBATCHILAR RENDER ----------
function renderAvvalgiNavbatchilar() {
  const group = document.getElementById('avvalgiNavbatchilarGroup');
  const list = document.getElementById('avvalgiNavbatchilarList');

  if (avvalgiNavbatchilar.length === 0) {
    group.style.display = 'none';
    return;
  }
  group.style.display = 'block';

  const guruhlangan = {};
  avvalgiNavbatchilar.forEach(n => {
    if (!guruhlangan[n.ijarachi_id]) {
      guruhlangan[n.ijarachi_id] = { ism: n.ijarachi.ismi, vazifalar: [], holat: n.holat };
    }
    guruhlangan[n.ijarachi_id].vazifalar.push(n.vazifa.nomi);
  });

  list.innerHTML = Object.values(guruhlangan).map(g => {
    let status = '✅ Bajardi'; let colorClass = 'bajardi';
    if (g.holat === 'bajarmadi') { status = '❌ Bajarmadi'; colorClass = 'bajarmadi'; }
    else if (g.holat === 'qisman') { status = '⚠️ Qisman'; colorClass = 'qisman'; }

    return `
      <div class="ij-item ${colorClass}" style="cursor: default; border-left-color: #94a3b8;">
        <div class="ij-avatar">👤</div>
        <div class="ij-info">
          <h3>${g.ism}</h3>
          <div class="navbat-soni" style="font-size:12px;">📋 ${g.vazifalar.join(', ')}</div>
        </div>
        <span class="holat-badge ${colorClass}">${status}</span>
      </div>
    `;
  }).join('');
}

// ---------- IJARACHILAR RO'YXATI ----------
function ijarachiRoyxatRender() {
  const el = document.getElementById('ijarachiList');
  if (ijarachiList.length === 0) { el.innerHTML = '<p class="loading">Ijarachilar yo\'q.</p>'; return; }

  const faolIdlar = faolNavbatchilar.map(n => n.ijarachi_id);
  const tartiblangan = [...ijarachiList]
    .filter(ij => !faolIdlar.includes(ij.id))
    .sort((a, b) => (jarimaMap[a.id]?.navbat_soni || 0) - (jarimaMap[b.id]?.navbat_soni || 0));

  if (tartiblangan.length === 0) { el.innerHTML = '<p class="loading">Barcha ijarachilar hozir navbatchi.</p>'; return; }

  el.innerHTML = tartiblangan.map(ij => {
    const navbatSoni = jarimaMap[ij.id]?.navbat_soni || 0;
    return `
      <div class="ij-item" onclick="tayinlashOch('${ij.id}', '${ij.ismi.replace(/'/g, "\\'")}')">
        ${ij.profil_rasm ? `<img src="${ij.profil_rasm}" class="ij-avatar">` : `<div class="ij-avatar">👤</div>`}
        <div class="ij-info">
          <h3>${ij.ismi}</h3>
          <div class="navbat-soni">Navbatchi bo'lgan: <b>${navbatSoni} marta</b></div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- TAYINLASH MODALI ----------
function tayinlashOch(ijarachiId, ism) {
  if (vazifalar.length === 0) { alert("Avval 2-tabda vazifa qo'shing!"); return; }

  document.getElementById('tayinlashIjarachiId').value = ijarachiId;
  document.getElementById('tayinlashIsm').textContent = "👤 " + ism;
  
  const bandVazifaIdlar = faolNavbatchilar.map(n => n.vazifa_id);
  const boshVazifalar = vazifalar.filter(v => !bandVazifaIdlar.includes(v.id));

  if (boshVazifalar.length === 0) { alert("Bugun uchun barcha vazifalar allaqachon taqsimlangan!"); return; }

  document.getElementById('tayinlashVazifalarList').innerHTML = boshVazifalar.map(v => `
    <label class="vazifa-checkbox" id="lbl-vazifa-${v.id}">
      <input type="checkbox" value="${v.id}" onchange="toggleCheckbox('${v.id}')">
      <span>${v.nomi}</span>
    </label>
  `).join('');
  
  document.getElementById('tayinlashModal').classList.add('active');
}

window.toggleCheckbox = function(id) {
  const cb = document.querySelector(`input[value="${id}"]`);
  const label = document.getElementById('lbl-vazifa-' + id);
  if (cb.checked) label.classList.add('selected');
  else label.classList.remove('selected');
};

document.getElementById('btnTayinlashSave').onclick = async () => {
  const ijId = document.getElementById('tayinlashIjarachiId').value;
  const checked = Array.from(document.querySelectorAll('#tayinlashVazifalarList input:checked')).map(cb => cb.value);
  if (checked.length === 0) { alert("Kamida 1 ta vazifani tanlang!"); return; }

  const bugun = new Date().toISOString().slice(0,10);
  for (const vazifaId of checked) {
    await supabaseClient.from('navbatchi_tarix').insert({ ijarachi_id: ijId, vazifa_id: vazifaId, sana: bugun, holat: 'kutilmoqda' });
  }

  // Navbat sonini +1 faqat shu yerda oshiramiz (yangi odam tayinlanganda)
  const mavjudJarima = jarimaMap[ijId];
  if (mavjudJarima) {
    await supabaseClient.from('jarima').update({
      navbat_soni: (mavjudJarima.navbat_soni || 0) + 1,
      yangilangan_vaqt: new Date().toISOString()
    }).eq('ijarachi_id', ijId);
  } else {
    await supabaseClient.from('jarima').insert({ ijarachi_id: ijId, qiymat: 0, navbat_soni: 1 });
  }

  document.getElementById('tayinlashModal').classList.remove('active');
  malumotYukla();
};

// ---------- HOLAT BELGILASH (TUZATILGAN MANTIQ) ----------
async function holatBelgila(navIdlarStr, holat) {
  const navIds = navIdlarStr.split(',');
  const nav = faolNavbatchilar.find(n => n.id === navIds[0]);
  if (!nav) return;

  for (const id of navIds) {
    await supabaseClient.from('navbatchi_tarix').update({ holat }).eq('id', id);
  }

  // FAQAT "BAJARDI" BO'LGANDA NAVBAT SONI +1 BO'LADI
  const mavjudJarima = jarimaMap[nav.ijarachi_id] || { qiymat: 0, navbat_soni: 0 };
  let yangiJarima = mavjudJarima.qiymat || 0;
  let yangiNavbat = mavjudJarima.navbat_soni || 0;

  if (holat === 'bajardi') {
    yangiNavbat += 1; // Navbatchilik soni oshadi
  } else if (holat === 'bajarmadi') {
    yangiJarima += 2; // Faqat jarima oshadi, navbat o'zgarmaydi
  } else if (holat === 'qisman') {
    yangiJarima += 1; // Faqat jarima oshadi, navbat o'zgarmaydi
  }

  await supabaseClient.from('jarima').upsert({
    ijarachi_id: nav.ijarachi_id,
    qiymat: yangiJarima,
    navbat_soni: yangiNavbat,
    yangilangan_vaqt: new Date().toISOString()
  }, { onConflict: 'ijarachi_id' });

  malumotYukla();
}

// ---------- 2-TAB: VAZIFALAR ----------
function vazifaRender() {
  const el = document.getElementById('vazifaList');
  if (vazifalar.length === 0) {
    el.innerHTML = '<p class="loading">Hozircha vazifa yo\'q. Pastdan qo\'shing.</p>';
  } else {
    el.innerHTML = vazifalar.map((v, i) => `
      <div class="vazifa-item">
        <span>${i+1}. ${v.nomi}</span>
        <button onclick="vazifaOchir('${v.id}')">🗑️</button>
      </div>
    `).join('');
  }
}

document.getElementById('btnAddVazifa').addEventListener('click', async () => {
  const nomi = document.getElementById('yangiVazifa').value.trim();
  if (!nomi) return;
  await supabaseClient.from('vazifa').insert({ nomi });
  document.getElementById('yangiVazifa').value = '';
  const { data } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = data || [];
  vazifaRender();
});

async function vazifaOchir(id) {
  if (!confirm("Vazifani o'chirmoqchimisiz?")) return;
  await supabaseClient.from('vazifa').delete().eq('id', id);
  const { data } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = data || [];
  vazifaRender();
}

// ---------- PASTKI NAVIGATSIYA ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => window.location.href = `${btn.dataset.page}.html?id=${kvId || ''}`);
});

// ---------- ISHGA TUSHIRISH ----------
malumotYukla();