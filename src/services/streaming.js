const axios = require('axios');
const { formatSize, parseMediaInfo } = require('../utils/helpers');
const { obtenerInfoUsuario } = require('./tracker');
const { verificarCacheQbt, buscarTorrents, coincideEpisodio } = require('./streaming-helpers');

/**
 * Formatear título del stream al estilo Torrentio/Aiostream
 */
function formatStreamTitle(item) {
  const attrs = item.attributes;
  const name = attrs.name;
  const resolution = attrs.resolution || '';
  const typeRelease = attrs.type || '';
  const size = attrs.size || 0;
  const sizeFormatted = formatSize(size);
  const seeders = attrs.seeders || 0;
  const leechers = attrs.leechers || 0;
  const freeleech = attrs.freeleech || '0%';
  const uploader = attrs.uploader || 'Unknown';

  // Parsear media_info
  const mediaInfoData = parseMediaInfo(attrs.media_info || '');

  // Construir título formateado
  const lines = [];

  // Primera línea: resolución
  const resolutionEmoji = {
    '2160p': '🔥 4K UHD',
    '1080p': '💎 FHD',
    '720p': '📺 HD',
    '480p': '📱 SD'
  };
  const resDisplay = resolutionEmoji[resolution] || `📺 ${resolution}`;
  lines.push(resDisplay);

  // Segunda línea: nombre (truncado si es muy largo)
  let displayName = name;
  if (displayName.length > 60) {
    displayName = displayName.substring(0, 57) + '...';
  }
  lines.push(`🎬 ${displayName}`);

  // Tercera línea: tipo, codec, hdr, duración
  const techLine = [];
  if (typeRelease) {
    techLine.push(`🎥 ${typeRelease}`);
  }
  if (mediaInfoData.hdr) {
    techLine.push(mediaInfoData.hdr);
  }
  if (mediaInfoData.codec) {
    techLine.push(mediaInfoData.codec);
  }
  if (mediaInfoData.duration) {
    techLine.push(mediaInfoData.duration);
  }

  if (techLine.length > 0) {
    lines.push(techLine.join(' '));
  }

  // Cuarta línea: audio
  const audioLine = [];
  if (mediaInfoData.audio) {
    audioLine.push(mediaInfoData.audio);
  }
  if (mediaInfoData.channels) {
    audioLine.push(mediaInfoData.channels);
  }
  if (mediaInfoData.languages.length > 0) {
    audioLine.push('🗣️ ' + mediaInfoData.languages.join(' / '));
  }

  if (audioLine.length > 0) {
    lines.push(audioLine.join(' '));
  }

  // Quinta línea: tamaño, uploader, tracker
  lines.push(`📦 ${sizeFormatted} 🏷️ ${uploader} 📡 Lat-Team`);

  // Sexta línea: seeds/leech y freeleech
  let statusLine = `👥 S:${seeders} L:${leechers}`;
  if (freeleech !== '0%') {
    statusLine += ` 🔓 Free: ${freeleech}`;
  }
  lines.push(statusLine);

  return lines.join('\n');
}

/**
 * Convertir ID de IMDB a TMDB
 */
async function convertirImdbATmdb(id, apiKey) {
  // Solo si id tiene el formato tt32766897:1:2 tomar la parte de IMDB
  let imdbId = id;
  if (id.includes(':')) {
    const idParts = id.split(':');
    imdbId = idParts[0];
  }

  const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;

  console.log(`Convirtiendo IMDB a TMDB con URL: ${url}`);
  
  try {
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const data = response.data;
      if (data.movie_results && data.movie_results.length > 0) {
        console.log('es una pelicula');
        return { id: data.movie_results[0].id, type: 'movie' };
      } else if (data.tv_results && data.tv_results.length > 0) {
        console.log('es una serie');
        return { id: data.tv_results[0].id, type: 'tv' };
      } else {
        console.log('no se encontro nada');
        return { id: null, type: null };
      }
    } else {
      console.log('Error al convertir ID de IMDB a TMDB');
      return { id: null, type: null };
    }
  } catch (error) {
    console.log(`Error al convertir IMDB a TMDB: ${error.message}`);
    return { id: null, type: null };
  }
}

/**
 * Consultar streams de Lat-Team y TMDB
 */
async function consultarLatamTmdb(id, token, tmdbKey, domain, addonKey, qbtClient = null) {
  const { id: tmdbId, type: tipo } = await convertirImdbATmdb(id, tmdbKey);
  
  // Inicializar array de streams
  const streams = [];
  
  // Agregar streams informativos al inicio (solo una vez)
  // Stream 1: Información del tracker
  try {
    const userInfo = await obtenerInfoUsuario(token);
    if (userInfo) {
      streams.push({
        name: 'Lat-Team',
        title: `👤 ${userInfo.username} [${userInfo.group}]\n📊 Ratio: ${userInfo.ratio} | Buffer: ${userInfo.buffer}\n⬆️  Up: ${userInfo.uploaded} | ⬇️  Down: ${userInfo.downloaded}\n🌱 Seeding: ${userInfo.seeding} | 🔻 Leeching: ${userInfo.leeching}\n🎁 Bonus: ${userInfo.seedbonus} | ⚠️  H&R: ${userInfo.hit_and_runs}`,
        url: 'stremio:///detail/tracker/info'
      });
    }
  } catch (error) {
    console.log(`Error obteniendo info usuario: ${error.message}`);
  }

  // Stream 2: Información de qBittorrent
  if (qbtClient) {
    try {
      const qbtInfo = await qbtClient.obtenerInfoTransferencia();
      if (qbtInfo) {
        streams.push({
          name: 'Lat-Team',
          title: `🖥️  qBittorrent Stats\n⬇️  ${qbtInfo.dlSpeed}/s | ⬆️  ${qbtInfo.upSpeed}/s\n📥 Downloaded: ${qbtInfo.dlData}/s\n📤 Uploaded: ${qbtInfo.upData}\n💾 Espacio libre: ${qbtInfo.freeSpace}`,
          url: 'stremio:///detail/qbittorrent/stats'
        });
      }
    } catch (error) {
      console.log(`Error obteniendo info qBittorrent: ${error.message}`);
    }
  }

  if (tipo === 'movie') {
    const imdbId = id.replace('tt', '');
    
    // Procesar ambas consultas (IMDB y TMDB) de forma eficiente
    const searchQueries = [
      `imdbId=${imdbId}`,
      `tmdbId=${tmdbId}`
    ];
    
    const allTorrents = [];
    for (const query of searchQueries) {
      const torrents = await buscarTorrents(query, [1], token);
      allTorrents.push(...torrents);
    }
    
    // Procesar torrents y verificar cache
    const processedStreams = await Promise.all(
      allTorrents.map(async (item) => {
        let title = formatStreamTitle(item);
        
        // Verificar cache y añadir emoji si está presente
        const enCache = await verificarCacheQbt(qbtClient, item.id);
        if (enCache) {
          title = `⚡ ${title}`;
        }
        
        return {
          title,
          url: `${domain}/${addonKey}/rd1/${item.id}`
        };
      })
    );
    
    streams.push(...processedStreams);
    
    // Eliminar duplicados por URL
    const uniqueStreams = {};
    for (const stream of streams) {
      uniqueStreams[stream.url] = stream;
    }
    return Object.values(uniqueStreams);
  } else {
    // Es una serie
    const idParts = id.split(':');
    const imdb = idParts[0].replace('tt', '');
    const seasonNumber = idParts[1];
    const episodeNumber = idParts[2];

    // Procesar ambas consultas (IMDB y TMDB)
    const searchQueries = [
      `imdbId=${imdb}`,
      `tmdbId=${tmdbId}`
    ];
    
    const allTorrents = [];
    for (const query of searchQueries) {
      const torrents = await buscarTorrents(query, [2, 5, 8, 20], token);
      allTorrents.push(...torrents);
    }
    
    // Filtrar por episodio y procesar
    const processedStreams = await Promise.all(
      allTorrents
        .filter(item => coincideEpisodio(item.attributes.name, seasonNumber, episodeNumber))
        .map(async (item) => {
          let title = formatStreamTitle(item);
          
          // Verificar cache
          const enCache = await verificarCacheQbt(qbtClient, item.id);
          if (enCache) {
            title = `⚡ ${title}`;
          }
          
          return {
            title,
            url: `${domain}/${addonKey}/rd2/${seasonNumber}/${episodeNumber}/${item.id}`
          };
        })
    );
    
    streams.push(...processedStreams);

    // Eliminar duplicados
    const uniqueStreams = {};
    for (const stream of streams) {
      uniqueStreams[stream.url] = stream;
    }
    return Object.values(uniqueStreams);
  }
}

module.exports = {
  formatStreamTitle,
  convertirImdbATmdb,
  consultarLatamTmdb
};
