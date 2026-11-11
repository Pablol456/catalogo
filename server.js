require('dotenv').config({ quiet: true });
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

const dns=require('dns');
dns.setServers(['1.1.1.1','8.8.8.8']);

const Console = require('./models/Console');
const Game = require('./models/Game');

const app = express();
const PORT = process.env.PORT || 3000;
let bucket; // GridFS: donde se guardan las fotos dentro de MongoDB

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (!origin) return next();

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ error: 'Origen no autorizado.' });
  }

  if (originHost !== req.get('host') && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado.' });
  }

  res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Subida de imágenes en memoria (máx. 10 MB por foto, solo imágenes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- utilidades ----------
const isId = (id) => mongoose.isValidObjectId(id);
const toId = (id) => new mongoose.Types.ObjectId(id);

// ---------- acceso de administrador ----------
// La contraseña es corta, así que tras 5 intentos fallidos desde una misma IP se bloquea 15 minutos.
const MAX_FAILS = 5;
const BLOCK_MS = 15 * 60 * 1000;
const failedLogins = new Map(); // ip -> { n, until }

function sameKey(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return res.status(503).json({ error: 'Falta ADMIN_KEY en el archivo .env' });
  const now = Date.now();
  let entry = failedLogins.get(req.ip);
  if (entry?.until > now) {
    const min = Math.ceil((entry.until - now) / 60000);
    return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${min} min.` });
  }
  if (sameKey(req.get('x-admin-key') || '', key)) {
    failedLogins.delete(req.ip);
    return next();
  }
  if (!entry || entry.until) entry = { n: 0, until: 0 }; // empieza de cero si el bloqueo anterior ya pasó
  entry.n += 1;
  if (entry.n >= MAX_FAILS) entry.until = now + BLOCK_MS;
  failedLogins.set(req.ip, entry);
  const left = MAX_FAILS - entry.n;
  res.status(401).json({ error: left > 0 ? `Contraseña incorrecta. Te quedan ${left} intentos.` : 'Contraseña incorrecta. Acceso bloqueado 15 min.' });
}

function saveImage(file) {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(file.originalname, {
      metadata: { contentType: file.mimetype },
    });
    Readable.from(file.buffer)
      .pipe(stream)
      .on('error', reject)
      .on('finish', () => resolve(stream.id));
  });
}

async function deleteImage(id) {
  if (!id) return;
  try {
    await bucket.delete(toId(id));
  } catch {
    /* ya no existía */
  }
}

function parseData(req) {
  try {
    return req.body.data ? JSON.parse(req.body.data) : req.body;
  } catch {
    return {};
  }
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- imágenes ----------
app.get(
  '/api/images/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.sendStatus(400);
    const _id = toId(req.params.id);
    const [file] = await bucket.find({ _id }).toArray();
    if (!file) return res.sendStatus(404);
    res.set('Content-Type', file.metadata?.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    bucket.openDownloadStream(_id).on('error', () => res.end()).pipe(res);
  })
);

// ---------- consolas ----------
app.get(
  '/api/consoles',
  wrap(async (req, res) => {
    const consoles = await Console.find().sort({ year: 1, name: 1 }).lean();
    // gameCount: juegos que siguen en la colección · soldCount: juegos vendidos
    const counts = await Game.aggregate([
      { $group: { _id: '$console', n: { $sum: { $cond: ['$sold', 0, 1] } }, sold: { $sum: { $cond: ['$sold', 1, 0] } } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    res.json(consoles.map((c) => ({ ...c, gameCount: map[String(c._id)]?.n || 0, soldCount: map[String(c._id)]?.sold || 0 })));
  })
);

app.get(
  '/api/consoles/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.sendStatus(404);
    const c = await Console.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: 'Consola no encontrada' });
    res.json(c);
  })
);

app.post(
  '/api/consoles',
  requireAdmin,
  upload.single('image'),
  wrap(async (req, res) => {
    const data = parseData(req);
    delete data.image;
    const c = new Console(data);
    if (req.file) c.image = await saveImage(req.file);
    await c.save();
    res.status(201).json(c);
  })
);

app.put(
  '/api/consoles/:id',
  requireAdmin,
  upload.single('image'),
  wrap(async (req, res) => {
    const c = isId(req.params.id) && (await Console.findById(req.params.id));
    if (!c) return res.status(404).json({ error: 'Consola no encontrada' });
    const data = parseData(req);
    delete data.image;
    delete data._id;
    c.set(data);
    if (req.file) {
      await deleteImage(c.image);
      c.image = await saveImage(req.file);
    }
    await c.save();
    res.json(c);
  })
);

app.delete(
  '/api/consoles/:id',
  requireAdmin,
  wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.sendStatus(404);
    const n = await Game.countDocuments({ console: req.params.id });
    if (n > 0) {
      return res.status(409).json({ error: `Esta consola tiene ${n} juego(s). Bórralos primero.` });
    }
    const c = await Console.findByIdAndDelete(req.params.id);
    if (c) await deleteImage(c.image);
    res.json({ ok: true });
  })
);

// ---------- juegos ----------
const IMAGE_KEYS = ['front', 'back', 'spine', 'media', 'mediaBack'];
const gameUpload = upload.fields([
  ...IMAGE_KEYS.map((name) => ({ name, maxCount: 1 })),
  { name: 'photos', maxCount: 30 },
]);

// Un estado vacío ('' o null) significa "sin evaluar": se guarda como ausente
function cleanCondition(data) {
  if (!data.condition) return;
  for (const k of Object.keys(data.condition)) {
    if (data.condition[k] === '' || data.condition[k] === null) data.condition[k] = undefined;
  }
}

async function applyGameFiles(game, files = {}) {
  for (const key of IMAGE_KEYS) {
    if (files[key]?.[0]) {
      await deleteImage(game.images?.[key]);
      game.set(`images.${key}`, await saveImage(files[key][0]));
    }
  }
  for (const f of files.photos || []) game.photos.push(await saveImage(f));
}

app.get(
  '/api/games',
  wrap(async (req, res) => {
    const filter = {};
    if (req.query.console) {
      if (!isId(req.query.console)) return res.json([]);
      filter.console = req.query.console;
    }
    res.json(await Game.find(filter).sort({ title: 1 }).lean());
  })
);

app.get(
  '/api/games/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.sendStatus(404);
    const g = await Game.findById(req.params.id).populate('console').lean();
    if (!g) return res.status(404).json({ error: 'Juego no encontrado' });
    res.json(g);
  })
);

app.post(
  '/api/games',
  requireAdmin,
  gameUpload,
  wrap(async (req, res) => {
    const data = parseData(req);
    delete data.images;
    delete data.photos;
    cleanCondition(data);
    const g = new Game(data);
    await applyGameFiles(g, req.files);
    await g.save();
    res.status(201).json(g);
  })
);

app.put(
  '/api/games/:id',
  requireAdmin,
  gameUpload,
  wrap(async (req, res) => {
    const g = isId(req.params.id) && (await Game.findById(req.params.id));
    if (!g) return res.status(404).json({ error: 'Juego no encontrado' });
    const data = parseData(req);
    const removePhotos = (data.removePhotos || []).map(String);
    const removeImages = data.removeImages || [];
    for (const k of ['images', 'photos', 'removePhotos', 'removeImages', '_id']) delete data[k];
    cleanCondition(data);

    g.set(data);
    for (const id of removePhotos) await deleteImage(id);
    g.photos = g.photos.filter((p) => !removePhotos.includes(String(p)));
    for (const k of removeImages) {
      if (IMAGE_KEYS.includes(k) && g.images?.[k]) {
        await deleteImage(g.images[k]);
        g.set(`images.${k}`, undefined);
      }
    }
    await applyGameFiles(g, req.files);
    await g.save();
    res.json(g);
  })
);

app.delete(
  '/api/games/:id',
  requireAdmin,
  wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.sendStatus(404);
    const g = await Game.findByIdAndDelete(req.params.id);
    if (g) {
      for (const id of [...Object.values(g.images || {}), ...g.photos]) await deleteImage(id);
    }
    res.json({ ok: true });
  })
);

app.post('/api/admin/check', requireAdmin, (req, res) => res.json({ ok: true }));

// ---------- errores ----------
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500;
  res.status(status).json({ error: err.message || 'Error interno' });
});

// ---------- arranque ----------
async function start() {
  if (!process.env.MONGODB_URI) {
    console.error('Falta MONGODB_URI en el archivo .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || 'Catálogo_videojuegos',
  });
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'images' });
  console.log('✔ Conectado a MongoDB');
  app.listen(PORT, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `✖ El puerto ${PORT} ya está en uso: probablemente el servidor ya está abierto en otra terminal.`
        : `✖ No se pudo iniciar el servidor: ${err.message}`);
      process.exit(1);
    }
    console.log(`🎮 Catálogo en         http://localhost:${PORT}`);
    console.log(`🔧 Panel de admin en   http://localhost:${PORT}/admin.html`);
  });
}

start().catch((err) => {
  console.error('No se pudo conectar a MongoDB:', err.message);
  console.error('Revisa la URI del .env y que tu IP esté permitida en Atlas (Network Access).');
  process.exit(1);
});
