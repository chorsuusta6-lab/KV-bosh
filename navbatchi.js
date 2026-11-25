// ============================================
// NAVBATCHI SAHIFASI — LOGIKA (3 TAB, TARIX BILAN)
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let vazifalar = [];
let ijarachiList = [];
let jarimaMap = {}; 
let faolNavbatchilar = []; 

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
  faolNavbatchilar = barchaTarix.filter(t => t.sana === bugun && t.holat === 'kutilmoqda');

  renderFaolNavbatchilar();
  ijarachiRoyxatRender();
  vazifaRender();
  renderTarix(barchaTarix);
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

  list.innerHTML = Object.values(guruhlangan).map(g => `
    <div class="ij-item faol" style="flex-wrap: wrap;">
      <div class="ij-avatar">👤</div>
      <div class="ij-info" style="flex: 1 1 100%;">
        <h3>${g.ism}</h3>
        <div class="navbat-soni" style="color: #d97706; font-size:13px;">📋 ${g.vazifalar.join(', ')}</div>
      </div>
      <div class="faol-actions">
        <button class="btn-sm btn-qisman" onclick="holatBelgila('${g.idlar.join(",")}', 'qisman')">⚠️ Qisman</button>
        <button class="btn-sm btn-bajardi" onclick="holatBelgila('${g.idlar.join(",")}', 'bajardi')">✅ Bajardi</button>
        <button class="btn-sm btn-bajarmadi" onclick="holatBelgila('${g.idlar.join(",")}', 'bajarmadi')">❌ Bajarmadi</button>
      </div>
    </div>
  `).join('');
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

  document.getElementById('tayinlashModal').classList.remove('active');
  malumotYukla();
};

// ---------- HOLAT BELGILASH ----------
async function holatBelgila(navIdlarStr, holat) {
  const navIds = navIdlarStr.split(',');
  const nav = faolNavbatchilar.find(n => n.id === navIds[0]);
  if (!nav) return;

  for (const id of navIds) {
    await supabaseClient.from('navbatchi_tarix').update({ holat }).eq('id', id);
  }

  const mavjudJarima = jarimaMap[nav.ijarachi_id] || { qiymat: 0, navbat_soni: 0 };
  let yangiJarima = mavjudJarima.qiymat || 0;
  let yangiNavbat = mavjudJarima.navbat_soni || 0;

  if (holat === 'bajardi') {
    yangiNavbat += 1;
  } else if (holat === 'bajarmadi') {
    yangiJarima += 2;
  } else if (holat === 'qisman') {
    yangiJarima += 1;
  }

  await supabaseClient.from('jarima').upsert({
    ijarachi_id: nav.ijarachi_id, qiymat: yangiJarima, navbat_soni: yangiNavbat, yangilangan_vaqt: new Date().toISOString()
  }, { onConflict: 'ijarachi_id' });

  malumotYukla();
}

// ---------- 3-TAB: TARIXNI RENDER QILISH ----------
function renderTarix(barchaTarix) {
  const el = document.getElementById('tarixList');
  
  const bajarilganlar = barchaTarix.filter(t => t.holat !== 'kutilmoqda').slice(0, 20);

  if (bajarilganlar.length === 0) {
    el.innerHTML = '<p class="loading">Tarix bo\'sh.</p>';
    return;
  }

  el.innerHTML = bajarilganlar.map(t => {
    let holatText = ''; let holatClass = ''; let jarimaText = '';

    if (t.holat === 'bajardi') {
      holatText = '✅ Bajardi'; holatClass = 'bajardi'; jarimaText = '+1 navbat';
    } else if (t.holat === 'bajarmadi') {
      holatText = '❌ Bajarmadi'; holatClass = 'bajarmadi'; jarimaText = '+2 jarima';
    } else if (t.holat === 'qisman') {
      holatText = '⚠️ Qisman'; holatClass = 'qisman'; jarimaText = '+1 jarima';
    }

    const d = new Date(t.sana);
    const sanaStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    return `
      <div class="tarix-card">
        <div class="tarix-head">
          <div class="tarix-ism">👤 ${t.ijarachi ? t.ijarachi.ismi : 'Noma\'lum'}</div>
          <div class="tarix-sana">${sanaStr}</div>
        </div>
        <div class="tarix-vazifa">📋 ${t.vazifa ? t.vazifa.nomi : 'Noma\'lum'}</div>
        <div class="tarix-footer">
          <span class="tarix-holat ${holatClass}">${holatText}</span>
          <span class="tarix-jarima">${jarimaText}</span>
        </div>
      </div>
    `;
  }).join('');
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
