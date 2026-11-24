// ============================================
// ASOSIY SAHIFA (INDEX) — LOGIKA
// ============================================

let kvList = [];
let ijarachiList = [];
let jarimaMap = {};
let deleteTargetId = null;

const OYLAR = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktyabr","Noyabr","Dekabr"];

// ---------- YORDAMCHI ----------

function pulFmt(n) {
  return Math.round(Number(n)).toLocaleString('uz-UZ') + " so'm";
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

async function getUmumiyTolov(ijarachiId) {
  const { data } = await supabaseClient.from('tolov_tarixi_yangi').select('summa').eq('ijarachi_id', ijarachiId);
  return (data || []).reduce((sum, t) => sum + Number(t.summa), 0);
}

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  const { data: kvData } = await supabaseClient.from('kv').select('*').order('nomi');
  kvList = kvData || [];

  const { data: ijData } = await supabaseClient.from('ijarachi').select('*');
  ijarachiList = ijData || [];

  const { data: jarimaData } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (jarimaData || []).forEach(j => { jarimaMap[j.ijarachi_id] = j.qiymat || 0; });

  await boshJoyYangila();
  await renderStatistika();
  await renderKvKartalari();
}

async function boshJoyYangila() {
  for (const kv of kvList) {
    const soni = ijarachiList.filter(i => i.id_kv === kv.id).length;
    const boshJoy = kv.sigimi - soni;
    if (Number(kv.bosh_joy) !== boshJoy) {
      await supabaseClient.from('kv').update({ bosh_joy: boshJoy }).eq('id', kv.id);
      kv.bosh_joy = boshJoy;
    }
  }
}

// ---------- STATISTIKA ----------

async function renderStatistika() {
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  let yaqin = 0, qarzdor = 0;

  for (const ij of ijarachiList) {
    const kelganOylar = hisoblaKechganOylar(ij.kelgan_kun, bugun);
    const umumiyKerak = kelganOylar * Number(ij.oylik_tolov);
    const umumiyTolangan = await getUmumiyTolov(ij.id);

    if (umumiyTolangan < umumiyKerak) {
      qarzdor++;
    } else {
      const kelganKun = new Date(ij.kelgan_kun).getDate();
      let tolovSanasi = new Date(bugun.getFullYear(), bugun.getMonth(), kelganKun);
      if (bugun <= tolovSanasi) {
        const farq = Math.ceil((tolovSanasi - bugun) / 86400000);
        if (farq <= 5) yaqin++;
      }
    }
  }

  document.getElementById('statJami').textContent = ijarachiList.length;
  document.getElementById('statYaqin').textContent = yaqin;
  document.getElementById('statQarzdor').textContent = qarzdor;

  const oyBosh = new Date(bugun.getFullYear(), bugun.getMonth(), 1).toISOString();
  const oyOxir = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: tolovlar } = await supabaseClient.from('tolov_tarixi_yangi').select('summa').gte('sana', oyBosh).lte('sana', oyOxir);
  const tushum = (tolovlar || []).reduce((s, t) => s + Number(t.summa), 0);

  const { data: xarajatlar } = await supabaseClient.from('xarajat').select('summa').eq('bekor', false).gte('sana', oyBosh).lte('sana', oyOxir);
  const xarajat = (xarajatlar || []).reduce((s, x) => s + Number(x.summa), 0);

  document.getElementById('statFoyda').textContent = pulFmt(tushum - xarajat);
}

// ---------- KV KARTALARI ----------

async function renderKvKartalari() {
  const grid = document.getElementById('kvGrid');
  if (kvList.length === 0) {
    grid.innerHTML = '<p class="loading">Hozircha KV yo\'q.</p>';
    return;
  }

  let kvlarBilanRang = [];

  for (const kv of kvList) {
    const ijarachilar = ijarachiList.filter(i => i.id_kv === kv.id);
    let engYomonRang = 'yashil';
    const bugun = new Date(); bugun.setHours(0,0,0,0);

    for (const ij of ijarachilar) {
      const jarima = jarimaMap[ij.id] || 0;
      if (jarima >= 10) { engYomonRang = 'qora'; break; }

      const kelganOylar = hisoblaKechganOylar(ij.kelgan_kun, bugun);
      const umumiyKerak = kelganOylar * Number(ij.oylik_tolov);
      const umumiyTolangan = await getUmumiyTolov(ij.id);

      if (umumiyTolangan < umumiyKerak) {
        engYomonRang = 'qizil';
      } else {
        const kelganKun = new Date(ij.kelgan_kun).getDate();
        let tolovSanasi = new Date(bugun.getFullYear(), bugun.getMonth(), kelganKun);
        if (bugun <= tolovSanasi) {
          const farq = Math.ceil((tolovSanasi - bugun) / 86400000);
          if (farq <= 5 && engYomonRang !== 'qizil') engYomonRang = 'sariq';
        }
      }
    }
    kvlarBilanRang.push({ kv, rang: engYomonRang });
  }

  const tartib = { qora: 1, qizil: 2, sariq: 3, yashil: 4 };
  kvlarBilanRang.sort((a, b) => tartib[a.rang] - tartib[b.rang]);

  grid.innerHTML = kvlarBilanRang.map(item => {
    const kv = item.kv;
    const ijarachilarSoni = ijarachiList.filter(i => i.id_kv === kv.id).length;
    const boshJoy = kv.sigimi - ijarachilarSoni;
    return `
      <div class="kv-card ${item.rang}" data-id="${kv.id}">
        <div class="kv-card-actions">
          <button title="Tahrirlash" onclick="event.stopPropagation(); tahrirlaKv('${kv.id}')">✏️</button>
          <button title="O'chirish" onclick="event.stopPropagation(); ochirishKv('${kv.id}', '${kv.nomi}')">🗑️</button>
        </div>
        <h3>${kv.nomi}</h3>
        <p>👥 Sig'im: ${kv.sigimi} kishi</p>
        <p>🟢 Bo'sh joy: ${boshJoy}</p>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.kv-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `ijarachi.html?id=${card.dataset.id}`;
    });
  });
}

// ---------- KV CRUD ----------

const kvModal = document.getElementById('kvModal');

document.getElementById('btnAddKv').addEventListener('click', () => {
  document.getElementById('kvModalTitle').textContent = "KV qo'shish";
  document.getElementById('kvId').value = '';
  document.getElementById('kvNomi').value = '';
  document.getElementById('kvSigimi').value = '';
  kvModal.classList.add('active');
});

function tahrirlaKv(id) {
  const kv = kvList.find(k => k.id === id);
  if (!kv) return;
  document.getElementById('kvModalTitle').textContent = "KV tahrirlash";
  document.getElementById('kvId').value = kv.id;
  document.getElementById('kvNomi').value = kv.nomi;
  document.getElementById('kvSigimi').value = kv.sigimi;
  kvModal.classList.add('active');
}

document.getElementById('kvModalClose').addEventListener('click', () => kvModal.classList.remove('active'));
document.getElementById('kvCancel').addEventListener('click', () => kvModal.classList.remove('active'));

document.getElementById('kvSave').addEventListener('click', async () => {
  const id = document.getElementById('kvId').value;
  const nomi = document.getElementById('kvNomi').value.trim();
  const sigimi = parseInt(document.getElementById('kvSigimi').value);

  if (!nomi || !sigimi || sigimi < 1) { alert("Nomi va sig'imni to'ldiring!"); return; }

  let ijarachilarSoni = 0;
  if (id) ijarachilarSoni = ijarachiList.filter(i => i.id_kv === id).length;
  const boshJoy = sigimi - ijarachilarSoni;

  if (boshJoy < 0) { alert(`Sig'im ${sigimi} dan kam! Bu KV da ${ijarachilarSoni} ta ijarachi bor.`); return; }

  if (id) await supabaseClient.from('kv').update({ nomi, sigimi, bosh_joy: boshJoy }).eq('id', id);
  else await supabaseClient.from('kv').insert({ nomi, sigimi, bosh_joy: sigimi });

  kvModal.classList.remove('active');
  malumotYukla();
});

// ---------- O'CHIRISH ----------

const deleteModal = document.getElementById('deleteModal');

function ochirishKv(id, nomi) {
  deleteTargetId = id;
  document.getElementById('deleteKvNomi').textContent = nomi;
  deleteModal.classList.add('active');
}

document.getElementById('deleteCancel').addEventListener('click', () => deleteModal.classList.remove('active'));

document.getElementById('deleteConfirm').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  await supabaseClient.from('kv').delete().eq('id', deleteTargetId);
  deleteModal.classList.remove('active');
  deleteTargetId = null;
  malumotYukla();
});

// ---------- ISHGA TUSHIRISH ----------

malumotYukla();