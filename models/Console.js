const mongoose = require('mongoose');

const ConsoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    manufacturer: { type: String, trim: true },
    year: Number,
    generation: Number,
    // Color de acento de la consola (tarjetas, portadas generadas)
    color: { type: String, default: '#3b82f6' },
    // Color del plástico de la caja (PS2 negro, Wii blanco, Xbox verde...)
    caseColor: { type: String, default: '#111111' },
    // Formato físico de la caja: define sus proporciones en 3D
    caseType: {
      type: String,
      enum: ['dvd', 'bluray', 'cd', 'switch', 'ds', 'carton'],
      default: 'dvd',
    },
    // Soporte del juego
    mediaType: { type: String, enum: ['disco', 'cartucho'], default: 'disco' },
    description: String,
    image: mongoose.Schema.Types.ObjectId, // foto de la consola (GridFS)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Console', ConsoleSchema);
