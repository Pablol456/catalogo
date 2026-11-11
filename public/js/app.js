// ============ Catálogo de videojuegos ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const state = { consoles: null, catalogId: null, games: [], filter: { q: '', sort: 'title' } };

async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

const ICON_DISC = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="20" width="52" height="28" rx="12" fill="currentColor" opacity=".9"/><circle cx="20" cy="34" r="5" fill="#0006"/><circle cx="44" cy="30" r="3" fill="#0006"/><circle cx="50" cy="36" r="3" fill="#0006"/><rect x="28" y="30" width="8" height="3" rx="1.5" fill="#0006"/></svg>`;
const ICON_CART = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 8h36v40l-4 8H18l-4-8z" fill="currentColor" opacity=".9"/><rect x="20" y="14" width="24" height="22" rx="2" fill="#0005"/><path d="M20 50h24" stroke="#0006" stroke-width="3"/></svg>`;

// ---------------- Router ----------------
async function route() {
  const [a, cid, g, gid] = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (a === 'c' && cid) {
      await showCatalog(cid);
      if (g === 'g' && gid) await openDetail(gid);
      else closeDetail();
    } else {
      closeDetail();
      await showHome();
    }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><h2>Ups…</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Volver al inicio</a></div>`;
  }
}
addEventListener('hashchange', route);

function setCrumbs(items) {
  $('#crumbs').innerHTML = items
    .map((it, i) => (i < items.length - 1 ? `<a href="${it.href}">${esc(it.label)}</a>${icon('chevron-right')}` : `<b>${esc(it.label)}</b>`))
    .join('');
}

// ---------------- Inicio: elegir consola ----------------
async function showHome() {
  state.catalogId = null;
  document.title = 'Catálogo de Videojuegos';
  document.body.style.removeProperty('--accent');
  setCrumbs([{ label: 'Consolas' }]);
  state.consoles = await api('/api/consoles');
  const n = state.consoles.length;
  const total = state.consoles.reduce((a, c) => a + c.gameCount, 0);

  view.innerHTML = `
    <section class="hero">
      <h1>Catálogo</h1>
      <p class="lead">Elige una consola para ver sus juegos.</p>
    </section>
    ${n ? `<div class="console-grid">${state.consoles.map(consoleCard).join('')}</div>`
        : `<div class="empty-state"><h2>Todavía no hay consolas</h2></div>`}`;
}

function consoleCard(c) {
  const visual = c.image
    ? `<img src="${imgUrl(c.image)}" alt="" loading="lazy" />`
    : `<div class="cc-icon">${c.mediaType === 'cartucho' ? ICON_CART : ICON_DISC}</div>`;
  return `
    <a class="console-card${c.gameCount ? '' : ' is-empty'}" href="#/c/${c._id}" style="--accent:${esc(c.color)}">
      <div class="cc-visual">${visual}</div>
      <div class="cc-body">
        <div>
          <h3>${esc(c.name)}</h3>
          <span class="cc-maker">${esc(c.manufacturer || '')}${c.year ? ' · ' + c.year : ''}</span>
        </div>
        <span class="cc-count">${plural(c.gameCount, 'juego', 'juegos')}</span>
      </div>
    </a>`;
}

// ---------------- Catálogo de una consola ----------------
async function showCatalog(cid) {
  if (state.catalogId === cid && $('#shelf', view)) return;
  const [cons, games] = await Promise.all([api(`/api/consoles/${cid}`), api(`/api/games?console=${cid}`)]);
  state.catalogId = cid;
  state.cons = cons;
  state.games = games;
  state.filter = { q: '', sort: 'title' };
  document.title = `${cons.name} · Catálogo`;
  document.body.style.setProperty('--accent', cons.color);
  setCrumbs([{ label: 'Consolas', href: '#/' }, { label: cons.name }]);

  // Las cifras del resumen son de los juegos que siguen en la colección (no de los vendidos)
  const owned = games.filter((g) => !g.sold);
  const soldCount = games.length - owned.length;
  const cib = owned.filter((g) => ['cib', 'sealed'].includes(completeness(g).key)).length;
  const scores = owned.map(conditionScore).filter(Boolean);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const priced = owned.filter(hasPrice);
  const spent = priced.reduce((a, g) => a + Number(g.acquired.price), 0);

  view.innerHTML = `
    <section class="catalog-head">
      <a class="back" href="#/">${icon('arrow-left')} Consolas</a>
      <h1>${esc(cons.name)}</h1>
      <p class="summary">
        <span><b>${owned.length}</b> ${owned.length === 1 ? 'juego' : 'juegos'}</span>
        ${cib ? `<span data-tip="Con caja, juego y manual."><b>${cib}</b> ${cib === 1 ? 'completo' : 'completos'}</span>` : ''}
        ${avg ? `<span data-tip="Media del estado de todas las piezas, de 0 a 10.">Estado medio <b>${avg.toFixed(1)}</b></span>` : ''}
        ${priced.length ? `<span data-tip="Suma de lo que pagaste por ${priced.length === owned.length ? 'los juegos de la colección' : `los ${priced.length} juegos con precio cargado`} (sin contar los vendidos).">Invertido <b>${fmtARS(spent)}</b></span>` : ''}
        ${soldCount ? `<span><b>${soldCount}</b> ${soldCount === 1 ? 'vendido' : 'vendidos'}</span>` : ''}
      </p>
    </section>
    ${games.length > 6 ? `
      <div class="toolbar">
        <input type="search" id="f-q" placeholder="Buscar un juego…" />
        <select id="f-sort" aria-label="Ordenar">
          <option value="title">Ordenar: A–Z</option>
          <option value="year">Ordenar: año</option>
          <option value="best">Ordenar: mejor estado</option>
          <option value="recent">Ordenar: más recientes</option>
        </select>
      </div>` : ''}
    <div id="shelf"></div>`;

  $('#f-q')?.addEventListener('input', (e) => { state.filter.q = e.target.value; renderShelf(); });
  $('#f-sort')?.addEventListener('change', (e) => { state.filter.sort = e.target.value; renderShelf(); });
  renderShelf();
}

// Orden de los juegos tal como se ven en la estantería: primero la colección, luego los vendidos
function navOrder() {
  const list = filteredGames();
  return [...list.filter((g) => !g.sold), ...list.filter((g) => g.sold)].map((g) => g._id);
}

function filteredGames() {
  const { q, sort } = state.filter;
  const needle = q.trim().toLowerCase();
  const list = state.games.filter((g) => !needle || [g.title, g.genre, g.developer, g.publisher].some((v) => v && v.toLowerCase().includes(needle)));
  const by = {
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
    year: (a, b) => (a.year || 9999) - (b.year || 9999),
    best: (a, b) => conditionScore(b) - conditionScore(a),
    recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  return list.sort(by[sort] || by.title);
}

function renderShelf() {
  const shelf = $('#shelf');
  const list = filteredGames();
  if (!state.games.length) {
    shelf.innerHTML = `<div class="empty-state"><h2>Todavía no hay juegos</h2><p>Esta consola aún no tiene juegos en la colección.</p></div>`;
    return;
  }
  if (!list.length) {
    shelf.innerHTML = `<div class="empty-state"><p>Ningún juego coincide con la búsqueda.</p></div>`;
    return;
  }
  shelf.innerHTML = '';
  state.shelfWidth = innerWidth;
  const size = CASE_TYPES[state.cons.caseType] || CASE_TYPES.dvd;
  // En el celular la caja se adapta al ancho de la tarjeta (2 por fila)
  const scale = innerWidth <= 600 ? clamp((innerWidth / 2 - 44) / (size.w + 24), 0.55, 1) : 1;
  // Primero los juegos de la colección; los vendidos van aparte, al final
  const owned = list.filter((g) => !g.sold);
  const sold = list.filter((g) => g.sold);
  const grid = (games) => {
    const el = document.createElement('div');
    el.className = 'shelf';
    games.forEach((g) => el.appendChild(shelfItem(g, scale)));
    return el;
  };
  if (owned.length) shelf.appendChild(grid(owned));
  if (sold.length) {
    shelf.insertAdjacentHTML('beforeend', `<h2 class="shelf-title">${icon('tag')} Vendidos <span>${sold.length}</span></h2>`);
    shelf.appendChild(grid(sold));
  }
}

function shelfItem(g, scale) {
  const comp = completeness(g);
  const item = document.createElement('button');
  item.className = `shelf-item${g.sold ? ' is-sold' : ''}`;
  item.setAttribute('aria-label', `Abrir ${g.title}${g.sold ? ' (vendido)' : ''}`);
  const wrap = document.createElement('div');
  wrap.className = 'box-wrap';
  wrap.appendChild(buildBox(g, state.cons, { scale }));
  item.appendChild(wrap);
  const meta = [g.year, g.region].filter(Boolean).map(esc).join(' · ');
  const salePrice = g.sold && g.sale?.price != null;
  const price = g.sold
    ? (salePrice ? `<span class="price">Vendido por ${fmtARS(g.sale.price)}</span>` : '')
    : (hasPrice(g) ? `<span class="price">${fmtARS(g.acquired.price)}</span>` : '');
  item.insertAdjacentHTML('beforeend', `
    ${g.sold ? '<span class="sold-ribbon">Vendido</span>' : ''}
    <div class="item-label">
      <b>${esc(g.title)}</b>
      ${meta ? `<span>${meta}</span>` : ''}
      ${price}
      ${g.sold ? '' : `<span class="badge b-${comp.key}">${esc(comp.label)}</span>`}
    </div>`);
  // Con el ratón, la caja sigue al puntero
  const rot = $('.box-rot', item);
  item.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = wrap.getBoundingClientRect();
    rot.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 70}deg`);
    rot.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 20}deg`);
  });
  item.addEventListener('pointerleave', () => { rot.style.removeProperty('--ry'); rot.style.removeProperty('--rx'); });
  item.addEventListener('click', () => (location.hash = `#/c/${state.catalogId}/g/${g._id}`));
  return item;
}

// ---------------- Detalle: la caja se abre ----------------
const detail = $('#detail');
let stageState = null;

async function openDetail(gid) {
  const game = await api(`/api/games/${gid}`);
  const cons = game.console;
  const comp = completeness(game);
  const media = mediaLabel(cons);
  const hasMedia = game.condition?.media !== 'no-incluido';
  document.title = `${game.title} · ${cons.name}`;
  setCrumbs([{ label: 'Consolas', href: '#/' }, { label: cons.name, href: `#/c/${cons._id}` }, { label: game.title }]);

  const photos = game.photos || [];
  const boxImgs = [['front', 'Portada'], ['back', 'Contraportada'], ['spine', 'Lomo'], ['media', media], ['mediaBack', `${media} (detrás)`]]
    .filter(([k]) => game.images?.[k]).map(([k, l]) => ({ id: game.images[k], label: l }));
  const meta = [
    game.year && `${game.year}`,
    game.region && `<span data-tip="${esc(REGIONS[game.region] || '')}">${esc(game.region)}</span>`,
    game.genre && esc(game.genre),
    game.players && `${esc(game.players)} jug.`,
  ].filter(Boolean);
  const hint = isTouch
    ? `Desliza para girar${hasMedia ? ` · toca el ${media.toLowerCase()} para darle la vuelta` : ''}`
    : `Arrastra para girar${hasMedia ? ` · clic en el ${media.toLowerCase()} para darle la vuelta` : ''}`;
  // Juego anterior / siguiente, en el mismo orden que la estantería
  const order = navOrder();
  const pos = order.indexOf(game._id);
  const cover = imgUrl(game.images?.front);

  detail.style.setProperty('--accent', cons.color);
  detail.innerHTML = `
    <div class="detail-backdrop" data-close></div>
    <div class="detail-card" role="dialog" aria-modal="true" aria-label="${esc(game.title)}">
      <header class="detail-bar">
        ${order.length > 1 && pos >= 0 ? `
          <div class="bar-nav">
            <button class="bar-btn" data-nav="-1" aria-label="Juego anterior" title="Juego anterior">${icon('chevron-left')}</button>
            <span class="bar-pos">${pos + 1} / ${order.length}</span>
            <button class="bar-btn" data-nav="1" aria-label="Juego siguiente" title="Juego siguiente">${icon('chevron-right')}</button>
          </div>` : ''}
        <b class="bar-title">${esc(game.title)}</b>
        <button class="bar-btn detail-close" data-close aria-label="Cerrar" title="Cerrar">${icon('close')}</button>
      </header>
      <div class="stage-col"${cover ? ` style="--cover:url('${cover}')"` : ''}>
        <div class="stage" id="stage"></div>
        <div class="stage-controls">
          <button class="btn primary" data-act="toggle">${icon('box')}<span>Abrir caja</span></button>
          ${hasMedia ? `<button class="btn" data-act="flip" hidden>${icon('flip')}<span>Dar vuelta al ${media.toLowerCase()}</span></button>` : ''}
          <button class="btn icon" data-act="turn" aria-label="Girar la caja" title="Girar la caja">${icon('rotate')}</button>
        </div>
        <p class="hint">${hint}</p>
      </div>
      <div class="info-col">
        <div class="info-head">
          <span class="chip accent">${esc(cons.name)}</span>
          ${game.sold ? `<span class="chip sold-chip">${icon('tag')} Vendido</span>` : ''}
          <h2>${esc(game.title)}</h2>
          ${priceCard(game)}
          <p class="meta">
            <span class="badge b-${comp.key}" data-tip="${esc(comp.desc)}">${esc(comp.label)}</span>
            ${meta.map((m) => `<span>${m}</span>`).join('')}
            ${game.favorite ? `<span class="fav">${icon('star')} Favorito</span>` : ''}
          </p>
          ${game.description ? `
            <p class="about" id="about">${esc(game.description)}</p>
            <button class="more-btn" id="aboutMore" hidden>Leer más</button>` : ''}
        </div>
        ${photosBlock(photos, boxImgs)}
        ${conditionBlock(game, cons)}
        ${infoBlock(game)}
      </div>
    </div>`;
  detail.hidden = false;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => detail.classList.add('show'));

  $$('[data-close]', detail).forEach((b) => b.addEventListener('click', () => (location.hash = `#/c/${cons._id}`)));
  $$('[data-nav]', detail).forEach((b) => b.addEventListener('click', () => {
    const next = order[(pos + Number(b.dataset.nav) + order.length) % order.length];
    location.hash = `#/c/${cons._id}/g/${next}`;
  }));

  // Descripción: se muestra recortada y se despliega con "Leer más" (solo si de verdad no cabe)
  const about = $('#about', detail);
  if (about && about.scrollHeight > about.clientHeight + 2) {
    const more = $('#aboutMore', detail);
    more.hidden = false;
    more.addEventListener('click', () => {
      const open = about.classList.toggle('open');
      more.textContent = open ? 'Leer menos' : 'Leer más';
    });
  }

  // Al bajar, el título del juego aparece en la barra superior
  const card = $('.detail-card', detail);
  const h2 = $('.info-head h2', detail);
  const bar = $('.detail-bar', detail);
  const onScroll = () => card.classList.toggle('scrolled', h2.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
  card.addEventListener('scroll', onScroll, { passive: true }); // celular: se desplaza toda la ficha
  $('.info-col', detail).addEventListener('scroll', onScroll, { passive: true }); // escritorio: solo la columna de info

  // Galería
  const gallery = [...photos.map((id, i) => ({ src: imgUrl(id), cap: `Foto ${i + 1} de ${photos.length}` })),
    ...boxImgs.map((b) => ({ src: imgUrl(b.id), cap: b.label }))];
  $$('[data-photo]', detail).forEach((el) => el.addEventListener('click', () => openLightbox(gallery, +el.dataset.photo)));

  // Escenario 3D
  const stageApi = setupStage(game, cons, (part) => {
    const row = $(`.cond-row[data-k="${part}"]`, detail);
    if (!row) return;
    row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
    // En escritorio la info tiene su propio scroll; en el celular no movemos la página para que se vea el giro
    if (innerWidth > 900) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // Tocar la fila del disco en "Estado" lo muestra en la caja 3D por esa cara
  $$('[data-flip-to]', detail).forEach((row) => row.addEventListener('click', () => {
    stageApi.showSide(row.dataset.flipTo === 'mediaBack' ? 'back' : 'front');
    if (innerWidth <= 900) $('#stage', detail).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
}

// Fecha guardada como día (sin hora): se lee en UTC para que no salga el día anterior
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '');

// Tarjeta destacada con el precio pagado (y, si se vendió, el precio de venta y la diferencia)
function priceCard(g) {
  const acq = g.acquired || {};
  const sale = g.sale || {};
  const paid = hasPrice(g);
  const soldFor = g.sold && sale.price != null;
  if (!paid && !g.sold) return '';
  const cell = (label, value, sub, cls = '') => `
    <div class="price-cell ${cls}">
      <span class="price-label">${label}</span>
      <b class="price-value">${value}</b>
      ${sub ? `<span class="price-sub">${sub}</span>` : ''}
    </div>`;
  const cells = [];
  if (paid) {
    const sub = [acq.date && `Comprado el ${fmtDate(acq.date)}`, acq.place && `en ${esc(acq.place)}`].filter(Boolean).join(' ');
    cells.push(cell('Precio pagado', fmtARS(acq.price), sub));
  }
  if (g.sold) {
    const sub = sale.date ? `El ${fmtDate(sale.date)}` : '';
    cells.push(soldFor ? cell('Vendido por', fmtARS(sale.price), sub, 'is-sale') : cell('Estado', 'Vendido', sub, 'is-sale'));
  }
  let diff = '';
  if (paid && soldFor) {
    const d = sale.price - acq.price;
    diff = `<p class="price-diff ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? 'Ganancia' : 'Pérdida'}: <b>${fmtARS(Math.abs(d))}</b></p>`;
  }
  return `<div class="price-card${g.sold ? ' sold' : ''}">${cells.join('')}${diff}</div>`;
}

function photosBlock(photos, boxImgs) {
  if (!photos.length && !boxImgs.length) return '';
  const thumbs = [
    ...photos.map((id, i) => `<button class="thumb" data-photo="${i}"><img src="${imgUrl(id)}" loading="lazy" alt="Foto ${i + 1}" /></button>`),
    ...boxImgs.map((b, i) => `<button class="thumb" data-photo="${photos.length + i}"><img src="${imgUrl(b.id)}" loading="lazy" alt="${esc(b.label)}" /><span>${esc(b.label)}</span></button>`),
  ];
  return `
    <section class="block">
      <h3 class="block-title">Fotos <span class="score">${thumbs.length}</span></h3>
      <div class="thumbs">${thumbs.join('')}</div>
    </section>`;
}

function conditionBlock(game, cons) {
  const c = game.condition || {};
  const hasMedia = c.media !== 'no-incluido';
  const rows = [
    ['box', 'Caja', c.boxNotes, 'box'],
    ['media', mediaLabel(cons) + (hasMedia ? ' (frente)' : ''), c.mediaNotes, cons.mediaType === 'cartucho' ? 'cart' : 'disc'],
    ...(hasMedia ? [['mediaBack', mediaBackInfo(cons).name, c.mediaBackNotes, 'flip', mediaBackInfo(cons).tip]] : []),
    ['manual', 'Manual', c.manualNotes, 'manual'],
  ];
  const UNRATED = { label: 'Sin evaluar', score: 0, color: '#64748b', desc: 'Todavía no se ha revisado esta cara.' };
  const score = conditionScore(game);
  return `
    <section class="block">
      <h3 class="block-title">Estado ${score ? `<span class="score" data-tip="Nota media de las piezas incluidas."><b>${score.toFixed(1)}</b> / 10</span>` : ''}</h3>
      <div class="cond-list">
        ${rows.map(([k, name, notes, ico, tip]) => {
          const info = CONDITIONS[c[k]] || (k === 'mediaBack' ? UNRATED : CONDITIONS.bueno);
          const flip = hasMedia && (k === 'media' || k === 'mediaBack');
          return `
            <div class="cond-row" data-k="${k}" style="--c:${info.color}"${flip ? ` data-flip-to="${k}"` : ''}>
              <div class="cond-icon">${icon(ico)}</div>
              <div class="cond-main">
                <div class="cond-top"><b>${esc(name)}</b><span class="pill" data-tip="${esc(info.desc)}">${info.label}</span></div>
                <div class="bar"><i style="width:${info.score * 10}%"></i></div>
                ${notes ? `<p class="cond-notes">${esc(notes)}</p>` : ''}
                ${tip && c[k] ? `<p class="cond-tip">${tip}</p>` : ''}
                ${flip ? `<span class="cond-go">Ver en la caja 3D ${icon('chevron-right')}</span>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
      ${game.extras?.length ? `<div class="extras">También incluye: ${game.extras.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      <details class="legend">
        <summary>¿Qué significa cada estado?</summary>
        <ul>${Object.values(CONDITIONS).map((x) => `<li style="--c:${x.color}"><i></i><b>${x.label}</b><span>${x.desc}</span></li>`).join('')}</ul>
      </details>
    </section>`;
}

function infoBlock(g) {
  const acq = g.acquired || {};
  const rows = [
    ['Desarrolladora', g.developer], ['Editora', g.publisher], ['Género', g.genre], ['Año', g.year],
    ['Jugadores', g.players], ['Región', g.region ? `${g.region} — ${REGIONS[g.region] || ''}` : ''],
    // Si hay precio, la fecha y el lugar ya salen en la tarjeta del precio
    ['Conseguido', hasPrice(g) ? '' : [fmtDate(acq.date), acq.place].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);
  // La descripción ya se muestra arriba, junto al título
  if (!rows.length && !g.notes) return '';
  return `
    <section class="block">
      <h3 class="block-title">Ficha</h3>
      ${rows.length ? `<dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      ${g.notes ? `<p class="desc note">${icon('note')}<span>${esc(g.notes)}</span></p>` : ''}
    </section>`;
}

const VIEWS = { front: { rx: -6, ry: 22 }, open: { rx: 12, ry: -6 } };

function setupStage(game, cons, onPart) {
  const stage = $('#stage', detail);
  const size = CASE_TYPES[cons.caseType] || CASE_TYPES.dvd;
  const mobile = innerWidth <= 900;
  const sw = stage.clientWidth || 500;
  const sh = mobile ? innerHeight * 0.4 : (stage.clientHeight || 500) - 60;
  // Abierta, la caja ocupa casi el doble de ancho: se deja sitio para que gire sin salirse
  const scale = clamp(Math.min(sh / size.h, sw / (size.w * 2.3)), 0.6, 2.6);
  // Cerrada ocupa la mitad de ancho, así que se amplía un poco para aprovechar el escenario
  const zoom = clamp(sh / (size.h * scale), 1, mobile ? 1.25 : 1.4);
  if (mobile) stage.style.height = Math.round(size.h * scale * zoom + 44) + 'px';
  stage.style.setProperty('--bh', size.h * scale * zoom + 'px');
  stage.style.setProperty('--bho', size.h * scale + 'px');
  const box = buildBox(game, cons, { scale, tags: true });
  box.style.setProperty('--zoom', zoom);
  stage.appendChild(box);
  const rot = $('.box-rot', box);
  const btn = $('[data-act="toggle"]', detail);
  const flipBtn = $('[data-act="flip"]', detail);
  const s = (stageState = { ...VIEWS.front, open: false });
  let spin = 0; // animación de inercia en curso

  const apply = () => {
    rot.style.setProperty('--rx', s.rx + 'deg');
    rot.style.setProperty('--ry', s.ry + 'deg');
  };
  const stopSpin = () => {
    cancelAnimationFrame(spin);
    spin = 0;
    box.classList.remove('dragging');
  };
  // Elige la vuelta equivalente más cercana al ángulo actual, para no dar giros de más
  const nearest = (target) => target + Math.round((s.ry - target) / 360) * 360;
  const setOpen = (open) => {
    stopSpin();
    s.open = open;
    box.classList.toggle('open', open);
    stage.classList.toggle('is-open', open);
    btn.lastElementChild.textContent = open ? 'Cerrar caja' : 'Abrir caja';
    if (flipBtn) flipBtn.hidden = !open;
    const v = open ? VIEWS.open : VIEWS.front;
    s.rx = v.rx;
    s.ry = nearest(v.ry);
    apply();
    if (open && box.classList.contains('sealed')) toast('Vista virtual: tu copia real sigue precintada');
  };
  const turn = (deg) => {
    stopSpin();
    s.ry += deg;
    apply();
  };
  s.turn = turn;
  apply();

  // Dar vuelta al disco / cartucho: se "aplasta" de lado, cambia de cara y vuelve
  const flipWrap = $('.media-flip', box);
  const mediaName = mediaLabel(cons).toLowerCase();
  const flip = () => {
    if (!flipWrap || flipWrap.classList.contains('flipping')) return;
    flipWrap.classList.add('flipping');
    setTimeout(() => {
      const back = box.classList.toggle('media-flipped');
      flipWrap.classList.remove('flipping');
      if (flipBtn) flipBtn.lastElementChild.textContent = back ? `Ver el ${mediaName} por delante` : `Dar vuelta al ${mediaName}`;
      onPart(back ? 'mediaBack' : 'media');
    }, reduceMotion ? 0 : 200);
  };
  const showSide = (side) => {
    const wasOpen = s.open;
    // Si está girada, vuelve a la vista de frente para que se vea el disco
    if (!wasOpen || Math.abs(s.ry - nearest(VIEWS.open.ry)) > 60) setOpen(true);
    if ((side === 'back') !== box.classList.contains('media-flipped')) setTimeout(flip, wasOpen ? 0 : 900);
  };
  flipBtn?.addEventListener('click', flip);
  btn.addEventListener('click', () => setOpen(!s.open));
  $('[data-act="turn"]', detail).addEventListener('click', () => turn(180));

  // Arrastrar para girar (con inercia al soltar) · clic para abrir o cerrar
  let down = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    stopSpin();
    down = { x: e.clientX, y: e.clientY, rx: s.rx, ry: s.ry, moved: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 6) return;
    down.moved = true;
    box.classList.add('dragging');
    s.ry = down.ry + dx * 0.45;
    if (e.pointerType !== 'touch') s.rx = clamp(down.rx - dy * 0.3, -40, 40);
    // Velocidad del gesto (grados por milisegundo), suavizada
    const dt = Math.max(1, e.timeStamp - down.lt);
    down.v = 0.5 * down.v + 0.5 * (((e.clientX - down.lx) * 0.45) / dt);
    down.lx = e.clientX;
    down.lt = e.timeStamp;
    apply();
  });
  stage.addEventListener('pointerup', (e) => {
    if (!down) return;
    const d = down;
    down = null;
    if (d.moved) {
      // Inercia: si se suelta con impulso, sigue girando y frena poco a poco
      let v = e.timeStamp - d.lt > 90 ? 0 : clamp(d.v * 16, -22, 22); // grados por fotograma
      if (reduceMotion || Math.abs(v) < 0.4) return box.classList.remove('dragging');
      const step = () => {
        v *= 0.94;
        s.ry += v;
        apply();
        if (Math.abs(v) > 0.05) spin = requestAnimationFrame(step);
        else stopSpin();
      };
      spin = requestAnimationFrame(step);
      return;
    }
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (s.open && hit?.closest('.media')) return flip();
    if (s.open && hit?.closest('.manual')) return onPart('manual');
    if (box.contains(hit)) setOpen(!s.open);
  });
  // Si el navegador toma el gesto (scroll vertical en el celular), se cancela el giro
  stage.addEventListener('pointercancel', () => { down = null; box.classList.remove('dragging'); });

  // Al llegar desde el catálogo, la caja se abre sola
  setTimeout(() => stageState === s && !s.open && setOpen(true), reduceMotion ? 0 : 650);
  return { showSide };
}

function closeDetail() {
  if (detail.hidden) return;
  stageState = null;
  detail.classList.remove('show');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { if (!detail.classList.contains('show')) { detail.hidden = true; detail.innerHTML = ''; } }, 300);
  if (state.cons) {
    document.title = `${state.cons.name} · Catálogo`;
    setCrumbs([{ label: 'Consolas', href: '#/' }, { label: state.cons.name }]);
  }
}

// ---------------- Visor de fotos ----------------
const lb = $('#lightbox');
let lbItems = [], lbIndex = 0;
function openLightbox(items, i) {
  lbItems = items;
  lbIndex = i;
  lb.hidden = false;
  showLb();
}
function showLb() {
  const it = lbItems[lbIndex];
  $('img', lb).src = it.src;
  $('figcaption', lb).textContent = `${it.cap}  ·  ${lbIndex + 1}/${lbItems.length}`;
  $$('.lb-nav', lb).forEach((b) => (b.hidden = lbItems.length < 2));
}
const lbMove = (d) => { lbIndex = (lbIndex + d + lbItems.length) % lbItems.length; showLb(); };
$('.lb-close', lb).addEventListener('click', () => (lb.hidden = true));
$('.prev', lb).addEventListener('click', () => lbMove(-1));
$('.next', lb).addEventListener('click', () => lbMove(1));
lb.addEventListener('click', (e) => { if (e.target === lb) lb.hidden = true; });
// Deslizar con el dedo para cambiar de foto
let lbTouch = null;
lb.addEventListener('touchstart', (e) => { lbTouch = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (lbTouch == null || lbItems.length < 2) return;
  const dx = e.changedTouches[0].clientX - lbTouch;
  lbTouch = null;
  if (Math.abs(dx) > 50) lbMove(dx < 0 ? 1 : -1);
});

addEventListener('keydown', (e) => {
  if (!lb.hidden) {
    if (e.key === 'Escape') lb.hidden = true;
    if (e.key === 'ArrowLeft') lbMove(-1);
    if (e.key === 'ArrowRight') lbMove(1);
    return;
  }
  if (detail.hidden) return;
  if (e.key === 'Escape' && state.catalogId) location.hash = `#/c/${state.catalogId}`;
  // Flechas: girar la caja
  if (stageState && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) stageState.turn(e.key === 'ArrowLeft' ? -30 : 30);
});

// ---------------- Tooltips ----------------
const tip = document.createElement('div');
tip.className = 'tooltip';
tip.hidden = true;
document.body.appendChild(tip);
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t || !t.dataset.tip) return (tip.hidden = true);
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  const r = t.getBoundingClientRect();
  const w = Math.min(280, innerWidth - 24);
  tip.style.maxWidth = w + 'px';
  tip.style.left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12)) + 'px';
  tip.style.top = r.bottom + 8 + 'px';
  if (isTouch) { clearTimeout(tip._t); tip._t = setTimeout(() => (tip.hidden = true), 3000); }
});
addEventListener('scroll', () => (tip.hidden = true), { passive: true, capture: true });

// Al girar el celular o cambiar el tamaño de la ventana, se recalculan las cajas
let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (state.catalogId && $('#shelf') && Math.abs(innerWidth - (state.shelfWidth || 0)) > 40) renderShelf();
  }, 250);
});

route();
