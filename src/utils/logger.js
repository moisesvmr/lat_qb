const pino = require('pino');

/**
 * Logger profesional con niveles y formato legible en todos los entornos
 * En producción usa pino-pretty sin colores para logs limpios pero legibles
 * En desarrollo usa pino-pretty con colores y formato expandido
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      colorize: process.env.NODE_ENV !== 'production',
      singleLine: process.env.NODE_ENV === 'production',
      messageFormat: process.env.NODE_ENV === 'production' 
        ? '{msg}' 
        : '{levelLabel} - {msg}'
    }
  }
});

module.exports = logger;
