const logger = require('../utils/logger');

/**
 * Valida que todas las variables de entorno requeridas estén presentes
 */
function validateEnv() {
  const required = {
    LATAM_TOKEN: 'Token de API de Lat-Team',
    TMDB_KEY: 'API Key de TMDB',
    ADDON_KEY: 'Clave de seguridad del addon',
    DOMAIN: 'Dominio público del servidor',
    QBIT_HOST: 'URL del servidor qBittorrent',
    QBIT_USER: 'Usuario de qBittorrent',
    QBIT_PASS: 'Contraseña de qBittorrent',
    TORRENT_API_KEY: 'Clave RSS de Lat-Team',
    TORRENT_MOVIES_PATH: 'Directorio para películas',
    TORRENT_SERIES_PATH: 'Directorio para series'
  };

  const missing = [];
  const empty = [];

  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`);
    } else if (process.env[key].trim() === '') {
      empty.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0) {
    logger.error('❌ Variables de entorno faltantes:');
    missing.forEach(item => logger.error(`   - ${item}`));
    throw new Error('Configuración incompleta. Revisa tu archivo .env');
  }

  if (empty.length > 0) {
    logger.error('❌ Variables de entorno vacías:');
    empty.forEach(item => logger.error(`   - ${item}`));
    throw new Error('Configuración incompleta. Revisa tu archivo .env');
  }

  // Validar formato de DOMAIN
  if (!process.env.DOMAIN.startsWith('http://') && !process.env.DOMAIN.startsWith('https://')) {
    logger.error('❌ DOMAIN debe comenzar con http:// o https://');
    throw new Error('DOMAIN inválido');
  }

  // Validar números
  const numbers = {
    PORT: process.env.PORT || '5000',
    MAX_RETRIES: process.env.MAX_RETRIES || '5',
    RETRY_DELAY: process.env.RETRY_DELAY || '2',
    CACHE_DURATION: process.env.CACHE_DURATION || '3600',
    QB_KEEP_ALIVE_INTERVAL: process.env.QB_KEEP_ALIVE_INTERVAL || '1800'
  };

  for (const [key, value] of Object.entries(numbers)) {
    if (isNaN(parseInt(value))) {
      logger.error(`❌ ${key} debe ser un número válido (actual: ${value})`);
      throw new Error(`Configuración inválida: ${key}`);
    }
  }

  logger.info('✅ Variables de entorno validadas correctamente');
}

module.exports = { validateEnv };
