const logger = require('../utils/logger');

/**
 * Sistema de caché en memoria con expiración automática
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Obtener URL del caché y reiniciar el contador si existe
   */
  get(key, duration) {
    if (this.cache.has(key)) {
      const { url, timestamp } = this.cache.get(key);
      const now = Date.now();
      const elapsed = (now - timestamp) / 1000;
      
      if (elapsed < duration) {
        this.hits++;
        // Reiniciar el contador al acceder
        this.cache.set(key, { url, timestamp: now });
        logger.info(`✓ Cache hit [${this.hits}/${this.hits + this.misses}] ${key} (${(duration - elapsed).toFixed(0)}s restantes)`);
        return url;
      } else {
        this.misses++;
        logger.info(`✗ Cache expirado: ${key} (inactivo ${elapsed.toFixed(0)}s)`);
        this.cache.delete(key);
      }
    } else {
      this.misses++;
    }
    return null;
  }

  /**
   * Guardar URL en caché con timestamp actual
   */
  set(key, url) {
    this.cache.set(key, { url, timestamp: Date.now() });
    logger.info(`✓ Cache guardado: ${key} (total: ${this.cache.size})`);
  }

  /**
   * Eliminar una entrada del caché
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.info(`✓ Cache eliminado: ${key}`);
    }
    return deleted;
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info(`✓ Cache limpiado: ${size} entradas eliminadas`);
  }

  /**
   * Obtener tamaño del caché
   */
  size() {
    return this.cache.size;
  }

  /**
   * Obtener estadísticas del cache
   */
  stats() {
    const hitRate = this.hits + this.misses > 0 
      ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2) 
      : 0;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`
    };
  }
}

module.exports = new Cache();
