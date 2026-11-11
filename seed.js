// Carga consolas iniciales.  Uso:
//   npm run seed        -> crea/actualiza consolas (y borra juegos de demo)
//   npm run seed:demo   -> además añade juegos de ejemplo (marcados como demo)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Console = require('./models/Console');
const Game = require('./models/Game');

const CONSOLES = [
  { name: 'Super Nintendo', manufacturer: 'Nintendo', year: 1990, generation: 4, color: '#7c3aed', caseColor: '#d9d4c7', caseType: 'carton', mediaType: 'cartucho' },
  { name: 'Nintendo 64', manufacturer: 'Nintendo', year: 1996, generation: 5, color: '#16a34a', caseColor: '#d9d4c7', caseType: 'carton', mediaType: 'cartucho' },
  { name: 'PlayStation', manufacturer: 'Sony', year: 1994, generation: 5, color: '#9ca3af', caseColor: '#1b1b1b', caseType: 'cd', mediaType: 'disco' },
  { name: 'PlayStation 2', manufacturer: 'Sony', year: 2000, generation: 6, color: '#2563eb', caseColor: '#0c0c0c', caseType: 'dvd', mediaType: 'disco' },
  { name: 'GameCube', manufacturer: 'Nintendo', year: 2001, generation: 6, color: '#6d28d9', caseColor: '#141414', caseType: 'dvd', mediaType: 'disco' },
  { name: 'Nintendo DS', manufacturer: 'Nintendo', year: 2004, generation: 7, color: '#64748b', caseColor: '#1a1a1a', caseType: 'ds', mediaType: 'cartucho' },
  { name: 'Xbox 360', manufacturer: 'Microsoft', year: 2005, generation: 7, color: '#65a30d', caseColor: '#3f7d20', caseType: 'dvd', mediaType: 'disco' },
  { name: 'Wii', manufacturer: 'Nintendo', year: 2006, generation: 7, color: '#0ea5e9', caseColor: '#f2f2f2', caseType: 'dvd', mediaType: 'disco' },
  { name: 'PlayStation 3', manufacturer: 'Sony', year: 2006, generation: 7, color: '#334155', caseColor: '#2a6fb5', caseType: 'bluray', mediaType: 'disco' },
  { name: 'Nintendo Switch', manufacturer: 'Nintendo', year: 2017, generation: 8, color: '#e60012', caseColor: '#d1001c', caseType: 'switch', mediaType: 'cartucho' },
];

const DEMO = [
  { console: 'Super Nintendo', title: 'Aventura de Ejemplo', year: 1993, genre: 'Plataformas', developer: 'Estudio Demo', region: 'PAL', players: '1-2', condition: { box: 'aceptable', media: 'muy-bueno', manual: 'bueno', boxNotes: 'Esquinas algo aplastadas y una pequeña rotura en la solapa.' }, extras: ['Póster'], description: 'Juego de ejemplo para ver cómo se muestra una caja de cartón con cartucho.' },
  { console: 'PlayStation', title: 'Carreras Demo', year: 1997, genre: 'Conducción', developer: 'Estudio Demo', region: 'PAL', players: '1-2', condition: { box: 'bueno', media: 'bueno', manual: 'como-nuevo', mediaNotes: 'Rayones finos que no afectan a la lectura.' }, description: 'Ejemplo de caja tipo "jewel case" de CD.' },
  { console: 'PlayStation 2', title: 'Leyenda de Prueba', year: 2004, genre: 'RPG', developer: 'Estudio Demo', region: 'PAL', players: '1', condition: { box: 'muy-bueno', media: 'como-nuevo', manual: 'muy-bueno' }, extras: ['Tarjeta de registro'], description: 'Ejemplo de caja DVD clásica.' },
  { console: 'PlayStation 2', title: 'Fútbol Ejemplo 2005', year: 2005, genre: 'Deportes', developer: 'Estudio Demo', region: 'PAL', players: '1-4', condition: { box: 'bueno', media: 'aceptable', manual: 'no-incluido', mediaNotes: 'Rayones circulares visibles.' }, description: 'Ejemplo de juego sin manual.' },
  { console: 'GameCube', title: 'Misterio Cúbico', year: 2003, genre: 'Aventura', developer: 'Estudio Demo', region: 'NTSC-U', players: '1', condition: { box: 'precintado', media: 'precintado', manual: 'precintado' }, description: 'Ejemplo de juego precintado.' },
  { console: 'Wii', title: 'Fiesta Demo', year: 2008, genre: 'Party', developer: 'Estudio Demo', region: 'PAL', players: '1-4', condition: { box: 'como-nuevo', media: 'muy-bueno', manual: 'bueno' }, description: 'Ejemplo de caja blanca de Wii.' },
  { console: 'Nintendo Switch', title: 'Isla Ejemplo', year: 2020, genre: 'Simulación', developer: 'Estudio Demo', region: 'PAL', players: '1-4', condition: { box: 'como-nuevo', media: 'como-nuevo', manual: 'no-incluido' }, description: 'Ejemplo de caja de Switch.' },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'Catálogo_videojuegos' });
  const byName = {};
  for (const c of CONSOLES) {
    byName[c.name] = await Console.findOneAndUpdate({ name: c.name }, c, { upsert: true, returnDocument: 'after' });
  }
  console.log(`✔ ${CONSOLES.length} consolas listas`);

  const removed = await Game.deleteMany({ demo: true });
  if (removed.deletedCount) console.log(`✔ ${removed.deletedCount} juegos de demo eliminados`);

  if (process.argv.includes('--demo')) {
    for (const g of DEMO) await Game.create({ ...g, console: byName[g.console]._id, demo: true });
    console.log(`✔ ${DEMO.length} juegos de demo añadidos`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
