const logger = require('../utils/logger');

const { spawn } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createReadStream } = require('fs');

/**
 * Servicio de streaming de video integrado
 * Adaptado de qb_stream para funcionar dentro del addon
 */

// Configuración
const STREAM_INACTIVE_TTL = 3600; // 1 hora en segundos
const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.ogv', '.mkv', '.avi', '.m4v', '.mov'];
const FFPROBE_TIMEOUT = 5000;
const FFPROBE_MAX_RETRIES = 3;
const FFPROBE_RETRY_DELAY = 2000;

// DB simple en memoria: token -> info
const streams = new Map();

// Cache de ffprobe en memoria y disco
const ffprobeCache = new Map();
let FFPROBE_CACHE_FILE = null;
let VOLUMES_PATHS = [];

/**
 * Inicializar el servicio de streaming
 */
function initStreamingService(volumesPaths = ['/volumes'], cacheFilePath = null) {
  VOLUMES_PATHS = volumesPaths.map(p => p.trim()).filter(p => p);
  FFPROBE_CACHE_FILE = cacheFilePath || path.join(process.cwd(), 'ffprobe_cache.json');
  logger.info(`🎬 Servicio de streaming inicializado`);
  logger.info(`   Volúmenes: ${VOLUMES_PATHS.join(', ')}`);
  logger.info(`   Cache: ${FFPROBE_CACHE_FILE}`);
}

/**
 * Carga el cache de ffprobe desde disco
 */
async function loadFFProbeCache() {
  if (!FFPROBE_CACHE_FILE) return;
  
  try {
    const data = await fs.readFile(FFPROBE_CACHE_FILE, 'utf-8');
    const cacheData = JSON.parse(data);
    
    // Verificar que los archivos aún existen
    for (const [filePath, cacheEntry] of Object.entries(cacheData)) {
      try {
        await fs.access(filePath);
        ffprobeCache.set(filePath, cacheEntry);
      } catch {
        // Archivo no existe, no cargar en cache
      }
    }
    
    logger.info(`✅ Cache de ffprobe cargado: ${ffprobeCache.size} entradas`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`⚠️  Error cargando cache de ffprobe: ${error.message}`);
    }
  }
}

/**
 * Guarda el cache de ffprobe a disco
 */
async function saveFFProbeCache() {
  if (!FFPROBE_CACHE_FILE) return;
  
  try {
    const cacheData = {};
    for (const [filePath, cacheEntry] of ffprobeCache.entries()) {
      cacheData[filePath] = cacheEntry;
    }
    
    await fs.writeFile(FFPROBE_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`❌ Error guardando cache de ffprobe: ${error.message}`);
  }
}

/**
 * Limpia tokens inactivos por más de 1 hora
 */
function cleanupExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  let count = 0;

  for (const [token, data] of streams.entries()) {
    const lastActivity = data.last_access || data.created;
    if (now - lastActivity > STREAM_INACTIVE_TTL) {
      streams.delete(token);
      count++;
    }
  }

  if (count > 0) {
    logger.info(`🗑️  Limpiados ${count} tokens de streaming inactivos`);
  }

  return count;
}

/**
 * Limpia entradas de cache de ffprobe para archivos que ya no existen
 */
async function cleanupFFProbeCache() {
  let removed = 0;
  
  for (const [filePath, cacheEntry] of ffprobeCache.entries()) {
    try {
      await fs.access(filePath);
      // Archivo existe, mantener en cache
    } catch {
      // Archivo no existe, eliminar de cache
      ffprobeCache.delete(filePath);
      removed++;
    }
  }
  
  if (removed > 0) {
    logger.info(`🗑️  Limpiados ${removed} archivos del cache de ffprobe`);
    await saveFFProbeCache();
  }
  
  return removed;
}

/**
 * Verifica si un archivo puede hacer streaming correctamente usando ffprobe
 */
async function checkFileWithFFProbe(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
      }
    });

    setTimeout(() => {
      ffprobe.kill();
      reject(new Error('ffprobe timeout'));
    }, FFPROBE_TIMEOUT);
  });
}

/**
 * Verifica si un archivo es streamable con cache y persistencia
 */
async function isFileStreamable(filePath) {
  // Verificar cache en memoria
  const cached = ffprobeCache.get(filePath);
  if (cached) {
    // Verificar que el archivo aún existe
    try {
      await fs.access(filePath);
      return cached.isValid;
    } catch {
      // Archivo eliminado, limpiar cache
      ffprobeCache.delete(filePath);
      await saveFFProbeCache();
      return false;
    }
  }

  // No está en cache, verificar con ffprobe
  for (let attempt = 1; attempt <= FFPROBE_MAX_RETRIES; attempt++) {
    try {
      const duration = await checkFileWithFFProbe(filePath);

      if (duration && duration !== 'N/A') {
        const durationFloat = parseFloat(duration);
        if (durationFloat > 0) {
          // Guardar en cache
          const cacheEntry = {
            isValid: true,
            duration: durationFloat,
            checkedAt: Date.now()
          };
          
          ffprobeCache.set(filePath, cacheEntry);
          await saveFFProbeCache();
          
          if (attempt > 1) {
            logger.info(`✅ Archivo listo después de ${attempt} intentos`);
          }
          return true;
        }
      }

      if (attempt < FFPROBE_MAX_RETRIES) {
        logger.info(`⏳ Intento ${attempt}/${FFPROBE_MAX_RETRIES}: Metadatos no disponibles, esperando ${FFPROBE_RETRY_DELAY / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, FFPROBE_RETRY_DELAY));
      }
    } catch (error) {
      logger.warn(`⚠️  Intento ${attempt}/${FFPROBE_MAX_RETRIES}: ${error.message}`);
      if (attempt < FFPROBE_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, FFPROBE_RETRY_DELAY));
      }
    }
  }

  logger.error(`❌ Archivo no disponible después de ${FFPROBE_MAX_RETRIES} intentos`);
  return false;
}

/**
 * Resuelve la ruta del archivo, buscando en volúmenes si es necesario
 */
async function resolveFilePath(filePath) {
  let resolvedPath = filePath;
  let useVolumes = false;
  let matchedVolume = null;

  // Si no es ruta absoluta, intentar resolverla
  if (!path.isAbsolute(filePath)) {
    const absPath = path.resolve(filePath);

    try {
      await fs.access(absPath);
      return { path: absPath, useVolumes: false, matchedVolume: null };
    } catch {
      // No existe como ruta relativa, buscar en volúmenes
      for (const volumePath of VOLUMES_PATHS) {
        const candidate = path.join(volumePath, filePath);
        try {
          await fs.access(candidate);
          return { path: candidate, useVolumes: true, matchedVolume: volumePath };
        } catch {
          continue;
        }
      }
      return { path: absPath, useVolumes: false, matchedVolume: null };
    }
  }

  return { path: resolvedPath, useVolumes, matchedVolume };
}

/**
 * Obtiene el Content-Type basado en la extensión del archivo
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime'
  };
  return contentTypeMap[ext] || 'video/mp4';
}

/**
 * Parsea el header Range para streaming
 */
function parseRangeHeader(range, fileSize) {
  if (!range) {
    return null;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  return {
    start: isNaN(start) ? 0 : start,
    end: isNaN(end) ? fileSize - 1 : end
  };
}

/**
 * Crea un token temporal para streaming
 * @param {string} filePath - Ruta del archivo
 * @param {string} baseUrl - URL base del servidor
 * @param {number} maxRetries - Número máximo de reintentos (default: 3)
 * @param {number} retryDelay - Delay entre reintentos en ms (default: 2000)
 * @returns {Promise<{url: string, token: string, inactive_expires_in: number, file_size: number}>}
 */
async function createStreamToken(filePath, baseUrl, maxRetries = 3, retryDelay = 2000) {
  // Limpiar tokens expirados
  cleanupExpiredTokens();

  // Resolver ruta del archivo
  const { path: resolvedPath, useVolumes, matchedVolume } = await resolveFilePath(filePath);

  // Verificar extensión permitida
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Formato no soportado: ${ext}`);
  }

  // Intentar verificar que el archivo existe con reintentos
  let stats = null;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      stats = await fs.stat(resolvedPath);
      
      if (!stats.isFile()) {
        throw new Error(`No es un archivo: ${filePath}`);
      }
      
      // Archivo encontrado, salir del loop
      if (attempt > 1) {
        logger.info(`✅ Archivo disponible después de ${attempt} intentos`);
      }
      break;
      
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        logger.info(`⏳ Intento ${attempt}/${maxRetries}: Archivo no disponible, esperando ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // Si después de todos los intentos no se encontró el archivo
  if (!stats) {
    logger.error(`❌ Archivo no disponible después de ${maxRetries} intentos: ${resolvedPath}`);
    throw new Error(`Archivo no disponible después de ${maxRetries} intentos. El torrent puede estar descargándose aún.`);
  }

  const fileSize = stats.size;
  const token = crypto.randomBytes(18).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  // Guardar en memoria
  streams.set(token, {
    path: resolvedPath,
    use_volumes: useVolumes,
    matched_volume: matchedVolume,
    created: now,
    last_access: now,
    access_count: 0,
    file_size: fileSize
  });

  const url = `${baseUrl}/video-stream/${token}`;
  
  logger.info(`✅ Token de streaming generado: ${token.substring(0, 8)}... | Activos: ${streams.size}`);

  return {
    url,
    token,
    inactive_expires_in: STREAM_INACTIVE_TTL,
    file_size: fileSize
  };
}

/**
 * Obtiene los datos de un stream por token
 * @param {string} token - Token del stream
 * @returns {object|null}
 */
function getStreamData(token) {
  return streams.get(token) || null;
}

/**
 * Actualiza el timestamp de acceso de un stream
 * @param {string} token - Token del stream
 */
function updateStreamAccess(token) {
  const data = streams.get(token);
  if (data) {
    const now = Math.floor(Date.now() / 1000);
    data.last_access = now;
    data.access_count = (data.access_count || 0) + 1;
  }
}

/**
 * Valida que un stream no esté inactivo
 * @param {string} token - Token del stream
 * @returns {boolean}
 */
function isStreamActive(token) {
  const data = streams.get(token);
  if (!data) return false;

  const now = Math.floor(Date.now() / 1000);
  const lastActivity = data.last_access || data.created;
  
  if (now - lastActivity > STREAM_INACTIVE_TTL) {
    streams.delete(token);
    return false;
  }

  return true;
}

/**
 * Obtiene estadísticas del servicio de streaming
 */
function getStreamingStats() {
  cleanupExpiredTokens();
  const now = Math.floor(Date.now() / 1000);

  const tokensInfo = [];
  for (const [token, data] of streams.entries()) {
    const inactiveFor = now - (data.last_access || data.created);
    const expiresAt = (data.last_access || data.created) + STREAM_INACTIVE_TTL;

    tokensInfo.push({
      token: token.substring(0, 8) + '...',
      path: path.basename(data.path),
      file_size: data.file_size || 0,
      access_count: data.access_count || 0,
      inactive_for_seconds: inactiveFor,
      expires_in_seconds: Math.max(0, expiresAt - now)
    });
  }

  return {
    total_tokens: streams.size,
    tokens: tokensInfo,
    cache_entries: ffprobeCache.size,
    volumes_paths: VOLUMES_PATHS,
    inactive_ttl_seconds: STREAM_INACTIVE_TTL
  };
}

module.exports = {
  initStreamingService,
  loadFFProbeCache,
  saveFFProbeCache,
  cleanupExpiredTokens,
  cleanupFFProbeCache,
  isFileStreamable,
  createStreamToken,
  getStreamData,
  updateStreamAccess,
  isStreamActive,
  getStreamingStats,
  getContentType,
  parseRangeHeader,
  createReadStream
};
