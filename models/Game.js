const mongoose = require('mongoose');

const CONDITIONS = ['precintado', 'como-nuevo', 'muy-bueno', 'bueno', 'aceptable', 'malo', 'no-incluido'];
const ObjectId = mongoose.Schema.Types.ObjectId;

const conditionField = { type: String, enum: CONDITIONS, default: 'bueno' };

const GameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    console: { type: ObjectId, ref: 'Console', required: true, index: true },
    year: Number,
    developer: String,
    publisher: String,
    genre: String,
    region: { type: String, enum: ['PAL', 'NTSC-U', 'NTSC-J', 'Otra'], default: 'PAL' },
    players: String,
    description: String,

    // Imágenes que "visten" la caja 3D (todas guardadas en GridFS)
    images: {
      front: ObjectId, // portada
      back: ObjectId, // contraportada
      spine: ObjectId, // lomo
      media: ObjectId, // serigrafía del disco / etiqueta del cartucho
      mediaBack: ObjectId, // disco por detrás (cara de datos) / parte trasera del cartucho
    },
    // Fotos reales de tu copia
    photos: [ObjectId],

    condition: {
      box: conditionField,
      media: conditionField,
      manual: conditionField,
      // Estado de la cara trasera del disco (sin valor = aún sin evaluar)
      mediaBack: { type: String, enum: CONDITIONS },
      mediaBackNotes: String,
      boxNotes: String,
      mediaNotes: String,
      manualNotes: String,
    },
    extras: [String], // póster, mapa, tarjeta de registro...
    notes: String,
    acquired: {
      date: Date,
      price: Number,
      place: String,
    },
    // Venta: el juego sigue en el catálogo, pero marcado como vendido
    sold: { type: Boolean, default: false, index: true },
    sale: {
      date: Date,
      price: Number, // en pesos argentinos
      buyer: String, // a quién o dónde se vendió
    },
    favorite: { type: Boolean, default: false },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GameSchema.statics.CONDITIONS = CONDITIONS;

module.exports = mongoose.model('Game', GameSchema);
