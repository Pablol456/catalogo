// Código compartido entre el catálogo y el panel de administración.

// ---------- Iconos SVG (trazo de 24×24, toman el color del texto) ----------
const ICON_PATHS = {
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 6a6 6 0 0 1 6 6"/>',
  cart: '<path d="M6 3h12v14l-2 4H8l-2-4z"/><rect x="9" y="6.5" width="6" height="6" rx="1"/><path d="M9.5 17h5"/>',
  flip: '<path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5"/><path d="M20.5 3.5v5h-5"/><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5"/><path d="M3.5 20.5v-5h5"/>',
  manual: '<path d="M5 19V5a2 2 0 0 1 2-2h12v14H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h12v-4"/><path d="M9 7h6M9 10.5h4"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
  undo: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 3.5v5h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  camera: '<path d="M4 7.5h3l2-3h6l2 3h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M7 21v-7h10v7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3"/><path d="m6 7 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  gamepad: '<path d="M7 8h10a5 5 0 0 1 5 5v1.5a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 2.3A3 3 0 0 1 2 14.5V13a5 5 0 0 1 5-5z"/><path d="M7.5 10.5v3.5M5.75 12.25h3.5"/><path d="M16 11.5h.01M18 13.5h.01" stroke-width="2.6"/>',
  note: '<path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6M8.5 8.5h7M8.5 12h4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  tag: '<path d="M3 4v7.5l9.5 9.5 8.5-8.5L11.5 3H4a1 1 0 0 0-1 1z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
};

function icon(name, cls = '') {
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// Cambia los <i data-icon="nombre"></i> escritos en el HTML por su SVG
function renderIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach((el) => (el.outerHTML = icon(el.dataset.icon, el.className)));
}

// Escala de estado: de mejor a peor. "score" va de 0 a 10 (se usa en las barras).
const CONDITIONS = {
  'precintado': { label: 'Precintado', score: 10, color: '#22d3ee', desc: 'Nunca abierto. Conserva el plástico original de fábrica.' },
  'como-nuevo': { label: 'Como nuevo', score: 9, color: '#4ade80', desc: 'Sin marcas de uso visibles. Parece recién comprado.' },
  'muy-bueno': { label: 'Muy bueno', score: 7.5, color: '#a3e635', desc: 'Marcas mínimas, solo se ven de cerca o a contraluz.' },
  'bueno': { label: 'Bueno', score: 6, color: '#facc15', desc: 'Uso normal: pequeños rayones o bordes algo gastados.' },
  'aceptable': { label: 'Aceptable', score: 4, color: '#fb923c', desc: 'Desgaste evidente (rayones, golpes, decoloración) pero funciona.' },
  'malo': { label: 'Malo', score: 2, color: '#f87171', desc: 'Daños importantes: roturas, rayones profundos o piezas despegadas.' },
  'no-incluido': { label: 'No incluido', score: 0, color: '#64748b', desc: 'Esta pieza no forma parte de tu copia.' },
};

const REGIONS = {
  'PAL': 'Europa, Australia y parte de Asia. Televisores a 50 Hz.',
  'NTSC-U': 'Norteamérica (EE. UU. y Canadá). Televisores a 60 Hz.',
  'NTSC-J': 'Japón. Suele tener portadas y textos en japonés.',
  'Otra': 'Otra región o edición especial.',
};

// Medidas reales aproximadas de cada tipo de caja (en mm ≈ px a escala 1)
const CASE_TYPES = {
  dvd: { label: 'Caja DVD (PS2, GameCube, Wii, Xbox…)', w: 135, h: 190, d: 14 },
  bluray: { label: 'Caja Blu-ray (PS3, PS4, PS5)', w: 135, h: 171, d: 13 },
  cd: { label: 'Caja CD "jewel case" (PlayStation, Saturn…)', w: 142, h: 125, d: 11 },
  switch: { label: 'Caja Switch', w: 105, h: 170, d: 11 },
  ds: { label: 'Caja DS / 3DS', w: 125, h: 137, d: 15 },
  carton: { label: 'Caja de cartón (SNES, N64, Mega Drive…)', w: 180, h: 128, d: 36 },
};

const imgUrl = (v) => (!v ? null : /^(blob:|data:|\/|https?:)/.test(v) ? v : `/api/images/${v}`);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Precio en pesos argentinos: "$ 15.000" (con dos centavos solo si los hay)
function fmtARS(n) {
  const dec = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
const hasPrice = (g) => g.acquired?.price != null && g.acquired.price !== '';

function mediaLabel(cons) {
  return cons?.mediaType === 'cartucho' ? 'Cartucho' : 'Disco';
}

// Explicación de qué hay en la parte trasera del disco o cartucho
function mediaBackInfo(cons) {
  return cons?.mediaType === 'cartucho'
    ? { name: 'Cartucho (por detrás)', tip: 'Por detrás están los contactos metálicos que conectan con la consola. Si están sucios u oxidados, el juego puede no arrancar.' }
    : { name: 'Disco (por detrás)', tip: 'Es la cara de datos, la que lee el láser de la consola. Los rayones en esta cara son los que pueden hacer que el juego no cargue.' };
}

// Resume qué tan completa está una copia
function completeness(game) {
  const c = game.condition || {};
  const has = (k) => c[k] && c[k] !== 'no-incluido';
  if (c.box === 'precintado') return { key: 'sealed', label: 'Precintado', desc: 'Sin abrir, tal como salió de fábrica.' };
  if (has('box') && has('media') && has('manual')) return { key: 'cib', label: 'Completo (CIB)', desc: 'CIB = "Complete In Box": caja, juego y manual.' };
  if (has('box') && has('media')) return { key: 'partial', label: 'Caja + juego', desc: 'Tiene caja y juego, pero le falta el manual.' };
  if (has('media')) return { key: 'loose', label: 'Suelto', desc: '"Loose": solo el juego, sin caja.' };
  if (has('box')) return { key: 'boxonly', label: 'Solo caja', desc: 'Tienes la caja pero no el juego.' };
  return { key: 'none', label: 'Sin datos', desc: '' };
}

function conditionScore(game) {
  const c = game.condition || {};
  const vals = ['box', 'media', 'mediaBack', 'manual'].map((k) => CONDITIONS[c[k]]).filter((x) => x && x.score > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b.score, 0) / vals.length;
}

// Contraste: decide si el texto sobre un color debe ser claro u oscuro
function isLight(hex = '#000') {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/**
 * Construye una caja 3D con CSS.
 *  game.images.{front,back,spine,media} pueden ser ids de GridFS o URLs (blob:) para previsualizar.
 *  opts.scale: tamaño relativo.
 */
function buildBox(game, cons, opts = {}) {
  const scale = opts.scale || 1;
  const type = CASE_TYPES[cons?.caseType] ? cons.caseType : 'dvd';
  const size = CASE_TYPES[type];
  const caseColor = cons?.caseColor || '#111';
  const accent = cons?.color || '#3b82f6';
  const img = game.images || {};
  const cond = game.condition || {};
  const front = imgUrl(img.front), back = imgUrl(img.back), spine = imgUrl(img.spine), media = imgUrl(img.media), mediaBack = imgUrl(img.mediaBack);
  const isCart = cons?.mediaType === 'cartucho';
  const hasMedia = cond.media !== 'no-incluido';
  const hasManual = cond.manual !== 'no-incluido';
  const t = esc(game.title || 'Sin título');
  const cn = esc(cons?.name || '');

  const el = document.createElement('div');
  el.className = `box3d case-${type}${opts.className ? ' ' + opts.className : ''}`;
  el.style.setProperty('--w', size.w * scale + 'px');
  el.style.setProperty('--h', size.h * scale + 'px');
  el.style.setProperty('--d', size.d * scale + 'px');
  el.style.setProperty('--s', scale);
  el.style.setProperty('--case', caseColor);
  el.style.setProperty('--accent', accent);
  el.style.setProperty('--case-ink', isLight(caseColor) ? '#1a1a1a' : '#f5f5f5');

  const bg = (u) => (u ? ` style="background-image:url('${u}')"` : '');
  const genFront = `
    <div class="gen-cover">
      <div class="gen-band">${cn}</div>
      <div class="gen-title">${t}</div>
      <div class="gen-meta">${esc(game.year || '')} ${game.region ? '· ' + esc(game.region) : ''}</div>
    </div>`;
  const genBack = `
    <div class="gen-back">
      <div class="gen-back-title">${t}</div>
      <p>${esc(game.description || '')}</p>
      <div class="gen-back-foot">${esc(game.developer || '')}</div>
    </div>`;
  const tag = (k, name, cls = '') => {
    if (!opts.tags) return '';
    const c = CONDITIONS[cond[k]] || { label: 'Sin evaluar', color: '#64748b' };
    return `<span class="tag ${cls}" style="--c:${c.color}"><i></i>${name} · ${c.label}</span>`;
  };
  // Si no hay foto del disco o cartucho, se usa la portada como arte de la etiqueta
  const cartArt = media || front;
  const discArt = media || front;
  // Cada soporte tiene dos caras: .face-a (frente) y .face-b (por detrás). Se alternan al darle la vuelta.
  const backCls = `face-b${mediaBack ? ' has-img' : ''}`;
  const disc = isCart
    ? `<div class="media-flip"><div class="media cart">
        <div class="face-a"><div class="cart-label"${bg(cartArt)}>${cartArt ? '' : `<span>${t}</span>`}</div></div>
        <div class="${backCls}"${bg(mediaBack)}>${mediaBack ? '' : '<div class="cart-back"><span>Contactos</span><div class="pins">' + '<i></i>'.repeat(12) + '</div></div>'}</div>
      </div></div>`
    : `<div class="media-flip"><div class="media disc">
        <div class="face-a"><div class="disc-print"${bg(discArt)}>${discArt ? '' : `<span>${t}</span>`}</div><div class="disc-hole"></div></div>
        <div class="${backCls}"${bg(mediaBack)}><div class="disc-hole"></div></div>
      </div></div>`;
  if (cond.box === 'precintado') el.classList.add('sealed');

  el.innerHTML = `
    <div class="box-rot">
      <div class="face f-back${back ? ' has-img' : ''}"${bg(back)}>${back ? '' : genBack}</div>
      <div class="face f-left${spine ? ' has-img' : ''}"${bg(spine)}>${spine ? '' : `<span class="spine-text">${t}</span><span class="spine-logo">${cn}</span>`}</div>
      <div class="face f-spine-in"></div>
      <div class="face f-right"></div>
      <div class="face f-top"></div>
      <div class="face f-bottom"></div>
      <div class="inside">
        <div class="tray">${hasMedia ? disc : `<div class="empty-slot">Sin ${mediaLabel(cons).toLowerCase()}</div>`}${hasMedia ? tag('media', mediaLabel(cons), 'tag-a') + tag('mediaBack', mediaLabel(cons) + ' (detrás)', 'tag-b') : ''}</div>
      </div>
      <div class="lid">
        <div class="lid-edge e-t"></div><div class="lid-edge e-b"></div><div class="lid-edge e-r"></div>
        <div class="face lid-front${front ? ' has-img' : ''}"${bg(front)}>${front ? '' : genFront}<div class="shine"></div></div>
        <div class="face lid-inner">
          ${hasManual
            ? `<div class="manual"${bg(front)}><span>MANUAL</span></div>${tag('manual', 'Manual')}`
            : `<div class="empty-slot">Sin manual</div>`}
        </div>
      </div>
    </div>`;
  return el;
}

// Los scripts se cargan al final del <body>: el HTML ya existe y se pueden dibujar sus iconos
renderIcons();
