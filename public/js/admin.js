// ============ Panel de administración ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let consoles = [];
let games = [];
let editingGame = null; // juego en edición (o null si es nuevo)
let editingConsole = null;
const pending = { front: null, back: null, spine: null, media: null }; // archivos nuevos elegidos
const removeImages = new Set();
const removePhotos = new Set();
const urlCache = new WeakMap();
const fileUrl = (f) => urlCache.get(f) || (urlCache.set(f, URL.createObjectURL(f)), urlCache.get(f));

// ---------- acceso con contraseña ----------
// La contraseña se guarda solo en esta pestaña (sessionStorage): al cerrar el navegador se vuelve a pedir.
let adminKey = '';
try {
  adminKey = sessionStorage.getItem('adminKey') || '';
  localStorage.removeItem('adminKey'); // clave antigua, ya no se usa
} catch {}

async function checkKey(k) {
  try {
    const r = await fetch('/api/admin/check', { method: 'POST', headers: { 'x-admin-key': k } });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, error: body.error };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

function lockPanel(msg = '') {
  adminKey = '';
  try { sessionStorage.removeItem('adminKey'); } catch {}
  $('.admin-main').hidden = true;
  $('#logout').hidden = true;
  $('#lock').hidden = false;
  $('#lockMsg').textContent = msg;
  $('#lockPass').value = '';
  $('#lockPass').focus();
}

let started = false;
async function unlockPanel() {
  $('#lock').hidden = true;
  $('.admin-main').hidden = false;
  $('#logout').hidden = false;
  if (!started) {
    started = true;
    await loadAll();
    editGame(null);
    editConsole(null);
    window.scrollTo(0, 0);
  }
}

$('#lockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const k = $('#lockPass').value;
  $('#lockBtn').disabled = true;
  const r = await checkKey(k);
  $('#lockBtn').disabled = false;
  if (r.ok) {
    adminKey = k;
    try { sessionStorage.setItem('adminKey', k); } catch {}
    unlockPanel();
  } else {
    $('#lockMsg').textContent = r.error || 'Contraseña incorrecta.';
    const card = $('.lock-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    $('#lockPass').select();
  }
});
$('#logout').addEventListener('click', () => lockPanel());

async function send(method, url, formData) {
  const r = await fetch(url, { method, body: formData, headers: { 'x-admin-key': adminKey } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 429) lockPanel(body.error || 'Vuelve a escribir la contraseña.');
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}

function toast(msg) {
  const t = $('#toast');
  t.innerHTML = msg; // msg puede llevar un icono; los textos externos se escapan antes
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- pestañas ----------
$$('.admin-tabs button').forEach((b) => b.addEventListener('click', () => {
  $$('.admin-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  $$('[data-section]').forEach((s) => (s.hidden = s.dataset.section !== b.dataset.tab));
}));

// ---------- carga ----------
async function loadAll() {
  [consoles, games] = await Promise.all([fetch('/api/consoles').then((r) => r.json()), fetch('/api/games').then((r) => r.json())]);
  const opts = consoles.map((c) => `<option value="${c._id}">${esc(c.name)}</option>`).join('');
  const prevFilter = $('#gFilter').value;
  $('#gFilter').innerHTML = `<option value="">Todas las consolas</option>${opts}`;
  $('#gFilter').value = prevFilter;
  const sel = $('#gForm [name="console"]');
  const prev = sel.value;
  sel.innerHTML = opts;
  if (prev) sel.value = prev;
  renderGameList();
  renderConsoleList();
}

// ================= JUEGOS =================
const gForm = $('#gForm');
const condOpts = Object.entries(CONDITIONS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
$$('.cond-sel').forEach((s) => (s.innerHTML = condOpts));
$$('.cond-sel-opt').forEach((s) => (s.innerHTML = '<option value="">— Sin evaluar —</option>' + condOpts));

function renderGameList() {
  const f = $('#gFilter').value;
  const q = $('#gSearch').value.trim().toLowerCase();
  const consById = Object.fromEntries(consoles.map((c) => [c._id, c]));
  const list = games.filter((g) => (!f || g.console === f) && (!q || g.title.toLowerCase().includes(q)));
  $('#gList').innerHTML = list.length
    ? list.map((g) => {
        const c = consById[g.console];
        const thumb = g.images?.front ? `<img src="${imgUrl(g.images.front)}" alt="" />` : `<span class="ph" style="background:${esc(c?.color || '#444')}"></span>`;
        const cls = [editingGame?._id === g._id ? 'on' : '', g.sold ? 'is-sold' : ''].filter(Boolean).join(' ');
        return `<li class="${cls}" data-id="${g._id}">${thumb}<div><b>${esc(g.title)}</b><small>${esc(c?.name || '?')} · ${g.photos?.length || 0} fotos${g.sold ? ' · <span class="sold-txt">vendido</span>' : ''}${g.demo ? ' · demo' : ''}</small></div></li>`;
      }).join('')
    : '<li class="empty">No hay juegos</li>';
  $$('#gList li[data-id]').forEach((li) => li.addEventListener('click', () => editGame(games.find((g) => g._id === li.dataset.id))));
}
$('#gFilter').addEventListener('change', renderGameList);
$('#gSearch').addEventListener('input', renderGameList);
$('#gNew').addEventListener('click', () => editGame(null));

function setField(form, name, value) {
  const el = form.elements[name];
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!value;
  else el.value = value ?? '';
}
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);

function editGame(g) {
  editingGame = g;
  gForm.reset();
  Object.keys(pending).forEach((k) => (pending[k] = null));
  removeImages.clear();
  removePhotos.clear();
  $('#gFormTitle').textContent = g ? `Editar: ${g.title}` : 'Nuevo juego';
  $('#gDelete').hidden = !g;
  $('#gMsg').textContent = '';
  for (const el of gForm.elements) {
    if (!el.name || el.type === 'file') continue;
    let v = g ? get(g, el.name) : undefined;
    if (el.name === 'extras') v = (v || []).join(', ');
    if ((el.name === 'acquired.date' || el.name === 'sale.date') && v) v = String(v).slice(0, 10);
    if (el.classList.contains('cond-sel') && !v) v = 'bueno';
    if (el.name === 'region' && !v) v = 'PAL';
    if (el.name === 'console' && !v) v = $('#gFilter').value || consoles[0]?._id;
    setField(gForm, el.name, v);
  }
  syncSaleFields();
  renderBoxImgs();
  renderPhotos();
  renderGameList();
  updatePreview();
  gForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const BOX_SLOTS = [['front', 'Portada'], ['back', 'Contraportada'], ['spine', 'Lomo'], ['media', 'Disco / etiqueta'], ['mediaBack', 'Disco por detrás']];
function renderBoxImgs() {
  $('#boxImgs').innerHTML = BOX_SLOTS.map(([k, label]) => {
    const cur = pending[k] ? fileUrl(pending[k]) : !removeImages.has(k) && editingGame?.images?.[k] ? imgUrl(editingGame.images[k]) : null;
    return `
      <div class="img-slot">
        <span>${label}</span>
        <label class="drop" style="${cur ? `background-image:url('${cur}')` : ''}">
          ${cur ? '' : `<em>${icon('image')} Elegir imagen</em>`}
          <input type="file" accept="image/*" data-slot="${k}" />
        </label>
        ${cur ? `<button type="button" class="link" data-clear="${k}">Quitar</button>` : ''}
      </div>`;
  }).join('');
  $$('#boxImgs input[type=file]').forEach((inp) => inp.addEventListener('change', () => {
    pending[inp.dataset.slot] = inp.files[0] || null;
    removeImages.delete(inp.dataset.slot);
    renderBoxImgs();
    updatePreview();
  }));
  $$('#boxImgs [data-clear]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.clear;
    if (pending[k]) pending[k] = null;
    else removeImages.add(k);
    renderBoxImgs();
    updatePreview();
  }));
}

function renderPhotos() {
  const existing = (editingGame?.photos || []).map((id) => `
    <div class="ph-item${removePhotos.has(id) ? ' removed' : ''}" data-id="${id}">
      <img src="${imgUrl(id)}" alt="" /><button type="button" title="${removePhotos.has(id) ? 'Recuperar' : 'Quitar'}">${icon(removePhotos.has(id) ? 'undo' : 'close')}</button>
    </div>`).join('');
  const fresh = [...($('#photoInput').files || [])].map((f) => `<div class="ph-item new"><img src="${fileUrl(f)}" alt="" /><i>nueva</i></div>`).join('');
  $('#photoGrid').innerHTML = existing + fresh;
  $$('#photoGrid .ph-item[data-id] button').forEach((b) => b.addEventListener('click', () => {
    const id = b.parentElement.dataset.id;
    removePhotos.has(id) ? removePhotos.delete(id) : removePhotos.add(id);
    renderPhotos();
  }));
}
$('#photoInput').addEventListener('change', renderPhotos);

function readGameForm() {
  const data = {};
  for (const el of gForm.elements) {
    if (!el.name || el.type === 'file') continue;
    let v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (el.type === 'number') v = v === '' ? null : Number(v);
    if (el.name === 'extras') v = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
    if ((el.name === 'acquired.date' || el.name === 'sale.date') && !v) v = null;
    const parts = el.name.split('.');
    let o = data;
    while (parts.length > 1) o = o[parts[0]] ||= {}, parts.shift();
    o[parts[0]] = v;
  }
  // Si no está vendido, no se guardan datos de venta
  if (!data.sold) data.sale = { date: null, price: null };
  return data;
}

// Los campos de venta solo se muestran si el juego está marcado como vendido
const syncSaleFields = () => ($('#saleFields').hidden = !$('#soldCheck').checked);
$('#soldCheck').addEventListener('change', syncSaleFields);

// Vista previa 3D en vivo
let pvState = { open: false, ry: 24, flipped: false };
function updatePreview() {
  const data = readGameForm();
  const cons = consoles.find((c) => c._id === data.console) || {};
  const cart = cons.mediaType === 'cartucho';
  $('#mediaName').innerHTML = cart ? `${icon('cart')} Cartucho (frente)` : `${icon('disc')} Disco (frente)`;
  $('#mediaBackName').innerHTML = `${icon('flip')} ${cart ? 'Cartucho' : 'Disco'} (por detrás)`;
  $('#mediaBackNotes').placeholder = cart ? 'Notas: contactos sucios, oxidados…' : 'Notas: rayones en la cara de datos…';
  const mbSlot = $('#boxImgs [data-slot="mediaBack"]')?.closest('.img-slot')?.querySelector('span');
  if (mbSlot) mbSlot.textContent = cart ? 'Cartucho por detrás' : 'Disco por detrás';
  const images = {};
  for (const [k] of BOX_SLOTS) {
    if (pending[k]) images[k] = fileUrl(pending[k]);
    else if (!removeImages.has(k) && editingGame?.images?.[k]) images[k] = editingGame.images[k];
  }
  const size = CASE_TYPES[cons.caseType] || CASE_TYPES.dvd;
  const stage = $('#preview');
  const scale = Math.min(1.4, (stage.clientWidth || 300) / (size.w * 2.1), Math.min(260, (stage.clientHeight || 300) - 40) / size.h);
  const box = buildBox({ ...data, images }, cons, { scale, tags: true });
  if (pvState.open) box.classList.add('open');
  if (pvState.flipped) box.classList.add('media-flipped');
  const rot = $('.box-rot', box);
  rot.style.setProperty('--ry', (pvState.open ? -6 : pvState.ry) + 'deg');
  rot.style.setProperty('--rx', pvState.open ? '10deg' : '-6deg');
  rot.style.transition = 'none';
  stage.replaceChildren(box);
  requestAnimationFrame(() => (rot.style.transition = ''));
}
let pvTimer;
gForm.addEventListener('input', (e) => { if (e.target.type !== 'file') { clearTimeout(pvTimer); pvTimer = setTimeout(updatePreview, 150); } });
gForm.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') updatePreview(); });
$('#pvOpen').addEventListener('click', () => {
  pvState.open = !pvState.open;
  const box = $('#preview .box3d');
  const rot = $('.box-rot', box);
  box.classList.toggle('open', pvState.open);
  rot.style.setProperty('--ry', (pvState.open ? -6 : pvState.ry) + 'deg');
  rot.style.setProperty('--rx', pvState.open ? '10deg' : '-6deg');
});
// Dar vuelta al disco en la vista previa (abre la caja si está cerrada)
$('#pvFlip').addEventListener('click', () => {
  pvState.flipped = !pvState.flipped;
  if (!pvState.open) { pvState.open = true; updatePreview(); return; }
  const wrap = $('#preview .media-flip');
  if (!wrap) return;
  wrap.classList.add('flipping');
  setTimeout(() => { $('#preview .box3d').classList.toggle('media-flipped', pvState.flipped); wrap.classList.remove('flipping'); }, 200);
});
$('#pvTurn').addEventListener('click', () => {
  pvState.open = false;
  pvState.ry = ({ 24: 90, 90: 180, 180: -18, '-18': 24 })[pvState.ry] ?? 24;
  updatePreview();
});

gForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('button[type=submit]', gForm);
  btn.disabled = true;
  $('#gMsg').textContent = 'Guardando… (subiendo imágenes)';
  try {
    const data = readGameForm();
    if (editingGame) {
      data.removePhotos = [...removePhotos];
      data.removeImages = [...removeImages];
    }
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    for (const [k] of BOX_SLOTS) if (pending[k]) fd.append(k, pending[k]);
    for (const f of $('#photoInput').files) fd.append('photos', f);
    const saved = editingGame ? await send('PUT', `/api/games/${editingGame._id}`, fd) : await send('POST', '/api/games', fd);
    toast(`${icon('check')} Juego guardado`);
    await loadAll();
    editGame(games.find((g) => g._id === saved._id));
    $('#gMsg').innerHTML = `Guardado. <a href="/#/c/${saved.console}/g/${saved._id}" target="_blank">Ver en el catálogo ${icon('external')}</a>`;
  } catch (err) {
    $('#gMsg').innerHTML = `${icon('alert')} ${esc(err.message)}`;
  } finally {
    btn.disabled = false;
  }
});

$('#gDelete').addEventListener('click', async () => {
  if (!editingGame || !confirm(`¿Borrar «${editingGame.title}» y todas sus fotos? No se puede deshacer.`)) return;
  try {
    await send('DELETE', `/api/games/${editingGame._id}`);
    toast('Juego borrado');
    await loadAll();
    editGame(null);
  } catch (err) {
    toast(`${icon('alert')} ${esc(err.message)}`);
  }
});

// ================= CONSOLAS =================
const cForm = $('#cForm');
$('#caseTypeSel').innerHTML = Object.entries(CASE_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

function renderConsoleList() {
  $('#cList').innerHTML = consoles.map((c) => `
    <li class="${editingConsole?._id === c._id ? 'on' : ''}" data-id="${c._id}">
      ${c.image ? `<img src="${imgUrl(c.image)}" alt="" />` : `<span class="ph" style="background:${esc(c.color)}"></span>`}
      <div><b>${esc(c.name)}</b><small>${esc(c.manufacturer || '')} ${c.year || ''} · ${c.gameCount} juegos</small></div>
    </li>`).join('') || '<li class="empty">No hay consolas</li>';
  $$('#cList li[data-id]').forEach((li) => li.addEventListener('click', () => editConsole(consoles.find((c) => c._id === li.dataset.id))));
}
$('#cNew').addEventListener('click', () => editConsole(null));

function editConsole(c) {
  editingConsole = c;
  cForm.reset();
  $('#cFormTitle').textContent = c ? `Editar: ${c.name}` : 'Nueva consola';
  $('#cDelete').hidden = !c;
  $('#cMsg').textContent = '';
  for (const el of cForm.elements) {
    if (!el.name || el.type === 'file') continue;
    if (c && c[el.name] != null) el.value = c[el.name];
  }
  $('#cImgPreview').innerHTML = c?.image ? `<img class="cimg" src="${imgUrl(c.image)}" alt="" />` : '';
  renderConsoleList();
}

cForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = {};
    for (const el of cForm.elements) {
      if (!el.name || el.type === 'file') continue;
      data[el.name] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
    }
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    const file = cForm.elements.image.files[0];
    if (file) fd.append('image', file);
    const saved = editingConsole ? await send('PUT', `/api/consoles/${editingConsole._id}`, fd) : await send('POST', '/api/consoles', fd);
    toast(`${icon('check')} Consola guardada`);
    await loadAll();
    editConsole(consoles.find((c) => c._id === saved._id));
  } catch (err) {
    $('#cMsg').innerHTML = `${icon('alert')} ${esc(err.message)}`;
  }
});

$('#cDelete').addEventListener('click', async () => {
  if (!editingConsole || !confirm(`¿Borrar la consola «${editingConsole.name}»?`)) return;
  try {
    await send('DELETE', `/api/consoles/${editingConsole._id}`);
    toast('Consola borrada');
    await loadAll();
    editConsole(null);
  } catch (err) {
    toast(`${icon('alert')} ${esc(err.message)}`);
  }
});

// ---------- inicio: si esta pestaña ya tenía la contraseña, se comprueba y se entra directo ----------
(async () => {
  if (adminKey && (await checkKey(adminKey)).ok) unlockPanel();
  else lockPanel();
})();
