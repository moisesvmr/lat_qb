const axios = require('axios');
const database = require('./database');

/**
 * Verificar cache en qBittorrent para un torrent usando DB + Hash
 */
async function verificarCacheQbt(qbtClient, itemId) {
  if (!qbtClient) return false;
  
  try {
    // 1. Verificar si existe en DB local
    const dbEntry = database.get(itemId);
    if (!dbEntry) {
      return false; // No está en DB, definitivamente no está en cache
    }
    
    // 2. Verificar en qBittorrent por hash
    const { exists } = await qbtClient.verificarHash(dbEntry.infoHash);
    return exists;
  } catch (error) {
    console.log(`Error verificando cache para ${itemId}: ${error.message}`);
    return false;
  }
}

/**
 * Verificar múltiples torrents en batch (optimizado)
 * Reduce N llamadas a qBittorrent a solo 1 llamada
 */
async function verificarCacheBatch(qbtClient, itemIds) {
  if (!qbtClient || !itemIds || itemIds.length === 0) {
    return new Map();
  }
  
  try {
    // 1. Obtener entries de DB para todos los IDs
    const dbEntries = new Map();
    const hashes = [];
    
    for (const itemId of itemIds) {
      const dbEntry = database.get(itemId);
      if (dbEntry && dbEntry.infoHash) {
        dbEntries.set(dbEntry.infoHash, itemId);
        hashes.push(dbEntry.infoHash);
      }
    }
    
    if (hashes.length === 0) {
      console.log(`⚠️  Batch: Ningún torrent en DB, retornando mapa vacío`);
      return new Map(); // Ninguno en DB
    }
    
    // 2. Verificar todos los hashes en una sola llamada
    const hashesParam = hashes.join('|');
    const response = await qbtClient.session.get('/api/v2/torrents/info', {
      params: { hashes: hashesParam }
    });
    
    // 3. Crear mapa de resultados
    const cacheMap = new Map();
    if (response.status === 200 && response.data) {
      const existingHashes = new Set(response.data.map(t => t.hash));
      
      for (const itemId of itemIds) {
        const dbEntry = database.get(itemId);
        const enCache = dbEntry && existingHashes.has(dbEntry.infoHash);
        cacheMap.set(itemId, enCache);
      }
      
      const cached = Array.from(cacheMap.values()).filter(v => v).length;
      console.log(`⚡ Batch verificado: ${itemIds.length} torrents en 1 llamada (${cached} en cache)`);
    } else {
      console.log(`⚠️  Batch: respuesta inesperada de qBittorrent (status: ${response.status})`);
    }
    
    return cacheMap;
  } catch (error) {
    console.log(`❌ Error verificando cache batch: ${error.message}`);
    console.log(`⚠️  Fallback: retornando mapa vacío (todos se considerarán fuera de cache)`);
    
    // MEJORA: Opcionalmente podríamos hacer fallback a verificación individual
    // Para evitar trabajo innecesario, pero por ahora retornamos vacío para ser seguro
    return new Map();
  }
}

/**
 * Buscar torrents por ID (IMDB o TMDB) con categorías específicas
 */
async function buscarTorrents(searchId, categories, token) {
  const categoriesParam = categories.map(c => `categories[]=${c}`).join('&');
  const url = `https://lat-team.com/api/torrents/filter?${searchId}&${categoriesParam}&alive=True&api_token=${token}`;

  
  try {
    const response = await axios.get(url);
    return response.data.data || [];
  } catch (error) {
    console.log(`Error en consulta ${searchId}: ${error.message}`);
    return [];
  }
}

/**
 * Verificar si un nombre de torrent coincide con temporada/episodio
 */
function coincideEpisodio(name, seasonNumber, episodeNumber) {
  const seasonEpisode = `S${seasonNumber.padStart(2, '0')}E${episodeNumber.padStart(2, '0')}`;
  const seasonOnly = `S${seasonNumber.padStart(2, '0')} `;
  return name.includes(seasonEpisode) || name.includes(seasonOnly);
}

module.exports = {
  verificarCacheQbt,
  verificarCacheBatch,
  buscarTorrents,
  coincideEpisodio
};
