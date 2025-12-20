const axios = require('axios');

/**
 * Verificar cache en qBittorrent para un torrent
 */
async function verificarCacheQbt(qbtClient, itemId) {
  if (!qbtClient) return false;
  
  try {
    const enCache = await qbtClient.obtenerTorrentsConEtiqueta(itemId.toString());
    return enCache.length > 0;
  } catch (error) {
    console.log(`Error verificando cache para ${itemId}: ${error.message}`);
    return false;
  }
}

/**
 * Buscar torrents por ID (IMDB o TMDB) con categorías específicas
 */
async function buscarTorrents(searchId, categories, token) {
  const categoriesParam = categories.map(c => `categories[]=${c}`).join('&');
  const url = `https://lat-team.com/api/torrents/filter?${searchId}&${categoriesParam}&alive=True&api_token=${token}`;

  console.log(url);
  
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
  buscarTorrents,
  coincideEpisodio
};
