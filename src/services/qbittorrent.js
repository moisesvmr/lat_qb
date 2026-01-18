const logger = require('../utils/logger');

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

/**
 * Cliente para interactuar con la API de qBittorrent
 */
class QBittorrentClient {
  constructor(host, username, password) {
    this.host = host;
    this.username = username;
    this.password = password;
    this.session = null;
    this.cookieJar = new CookieJar();
  }

  /**
   * Conectar a qBittorrent y obtener sesión autenticada
   */
  async connect() {
    logger.info(`\n🔌 [conectar_qbittorrent] Intentando conectar...`);
    logger.info(`   Host: ${this.host}`);
    logger.info(`   Usuario: ${this.username}`);
    logger.info(`   Password: ${'*'.repeat(this.password?.length || 0)}`);

    const url = `${this.host}/api/v2/auth/login`;
    
    try {
      // Crear una instancia de axios que mantenga las cookies
      this.session = wrapper(axios.create({
        baseURL: this.host,
        timeout: 10000,
        jar: this.cookieJar,
        withCredentials: true
      }));

      // qBittorrent espera los datos como application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('password', this.password);

      const response = await this.session.post('/api/v2/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      logger.info(`   Status code: ${response.status}`);
      logger.info(`   Response: ${response.data}`);

      if (response.status === 200 && response.data === 'Ok.') {
        logger.info(`   ✅ Conexión exitosa`);
        return this.session;
      } else {
        logger.info(`   ❌ Error: Credenciales incorrectas o servidor no responde`);
        throw new Error('Error de autenticación con qBittorrent');
      }
    } catch (error) {
      logger.info(`   ❌ Excepción al conectar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verificar si un hash existe en qBittorrent y obtener su información
   */
  async verificarHash(infoHash) {
    logger.info(`\n🔍 [verificar_hash] Verificando hash en qBittorrent...`);
    logger.info(`   Hash: ${infoHash}`);
    
    const response = await this.session.get(`/api/v2/torrents/info`, {
      params: { hashes: infoHash }
    });

    if (response.status === 200 && response.data.length > 0) {
      const torrent = response.data[0];
      logger.info(`   ✅ Torrent encontrado: ${torrent.name}`);
      logger.info(`   Path: ${torrent.content_path}`);
      return {
        exists: true,
        torrent: torrent
      };
    } else {
      logger.info('   ❌ Hash no encontrado en qBittorrent');
      return {
        exists: false,
        torrent: null
      };
    }
  }

  /**
   * Agregar torrent desde URL con directorio específico y descarga secuencial
   */
  async agregarTorrentDesdeUrl(torrentUrl, savePath = null) {
    logger.info(`\n➕ [agregar_torrent_desde_url] Agregando torrent...`);
    logger.info(`   URL: ${torrentUrl}`);
    logger.info(`   Save Path recibido: ${savePath || 'default'}`);
    logger.info(`   Save Path tipo: ${typeof savePath}`);
    logger.info(`   Host: ${this.host}`);

    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('urls', torrentUrl);
      formData.append('sequentialDownload', 'true');
      formData.append('firstLastPiecePrio', 'true');
      
      // Agregar directorio de descarga si se especifica
      if (savePath) {
        logger.info(`   🔧 Configurando savePath: "${savePath}"`);
        formData.append('savepath', savePath);
        formData.append('autoTMM', 'false'); // Deshabilitar gestión automática de torrents
        logger.info(`   ✓ savepath y autoTMM agregados al formData`);
      } else {
        logger.info(`   ⚠️  No se especificó savePath, usando directorio por defecto de qBittorrent`);
      }

      const response = await this.session.post('/api/v2/torrents/add', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      logger.info(`   Status code: ${response.status}`);
      logger.info(`   Response data: ${JSON.stringify(response.data)}`);
      logger.info(`   Response type: ${typeof response.data}`);

      // qBittorrent puede devolver "Ok." o simplemente status 200
      if (response.status === 200) {
        if (response.data === 'Ok.' || response.data === '' || !response.data) {
          logger.info(`   ✅ Torrent agregado exitosamente`);
        } else if (response.data.includes && response.data.includes('Fails')) {
          logger.info(`   ❌ Error: ${response.data}`);
        } else {
          logger.info(`   ⚠️  Respuesta inesperada: ${response.data}`);
        }
      } else {
        logger.info(`   ❌ Error al agregar el torrent`);
      }
    } catch (error) {
      logger.info(`   ❌ Excepción al agregar torrent: ${error.message}`);
    }
  }

  /**
   * Obtener archivos de un torrent por su hash
   */
  async obtenerArchivosDeTorrent(torrentHash) {
    logger.info(`\n📁 [obtener_archivos_de_torrent] Obteniendo archivos...`);
    logger.info(`   Hash: ${torrentHash}`);
    logger.info(`   Host: ${this.host}`);

    const response = await this.session.get('/api/v2/torrents/files', {
      params: { hash: torrentHash }
    });

    logger.info(`   Status code: ${response.status}`);

    const archivos = [];
    if (response.status === 200) {
      const files = response.data;
      logger.info(`   Total archivos: ${files.length}`);

      for (const file of files) {
        const archivoInfo = {
          id: file.index,
          path: file.name
        };
        archivos.push(archivoInfo);
        logger.info(`      [${file.index}] ${file.name}`);
      }
    } else {
      logger.info(`   ❌ Error al obtener archivos del torrent`);
    }

    return archivos;
  }

  /**
   * Obtener nombre del torrent por su hash
   */
  async obtenerNombreTorrent(torrentHash) {
    logger.info(`\n📝 [obtener_nombre_torrent] Obteniendo nombre...`);
    logger.info(`   Hash: ${torrentHash}`);
    logger.info(`   Host: ${this.host}`);

    const response = await this.session.get('/api/v2/torrents/info', {
      params: { hashes: torrentHash }
    });

    logger.info(`   Status code: ${response.status}`);

    if (response.status === 200) {
      const torrents = response.data;
      if (torrents.length > 0) {
        const nombre = torrents[0].name;
        logger.info(`   ✅ Nombre: ${nombre}`);
        return nombre;
      } else {
        logger.info(`   ❌ No se encontró torrent con hash ${torrentHash}`);
        return null;
      }
    } else {
      logger.info(`   ❌ Error obteniendo nombre del torrent`);
      return null;
    }
  }

  /**
   * Obtener ID de capítulo específico (para series) usando hash directamente
   */
  async obtenerIdCapituloByHash(season, episode, hash) {
    logger.info(`\n📺 [obtener_id_capitulo_by_hash] Buscando episodio...`);
    logger.info(`   Season original: ${season}`);
    logger.info(`   Episode original: ${episode}`);
    logger.info(`   Hash: ${hash}`);
    logger.info(`   Host: ${this.host}`);

    // Si season y episode son de un dígito, agregar un 0 adelante
    if (season.length === 1) season = '0' + season;
    if (episode.length === 1) episode = '0' + episode;

    const cap = `S${season}E${episode}`;
    logger.info(`   Capítulo formateado: ${cap}`);

    const nombreTorrent = await this.obtenerNombreTorrent(hash);
    logger.info(`   Nombre torrent: ${nombreTorrent}`);

    const archivos = await this.obtenerArchivosDeTorrent(hash);
    logger.info(`   Total archivos en torrent: ${archivos.length}`);

    let idArchivo = null;
    let archivo1 = null;

    for (const archivo of archivos) {
      logger.info(`      Archivo ${archivo.id}: ${archivo.path}`);

      if (new RegExp(cap, 'i').test(archivo.path)) {
        archivo1 = archivo.path;
        idArchivo = archivo.id;
        logger.info(`      ✅ Coincidencia encontrada!`);
        break;
      }
    }

    if (idArchivo === null || archivo1 === null) {
      logger.info(`   ❌ No se encontró archivo con patrón ${cap}`);
      throw new Error(`No se encontró episodio ${cap} en el torrent`);
    }

    const resultado = {
      idArchivo,
      rutaArchivo: `${nombreTorrent}/${archivo1}`,
      hash
    };
    logger.info(`   Resultado: ID=${resultado.idArchivo}, Path=${resultado.rutaArchivo}, Hash=${resultado.hash}`);
    return resultado;
  }

  /**
   * Subir la prioridad de descarga de un archivo específico
   */
  async subirPrioridadArchivo(torrentHash, fileId) {
    logger.info(`\n⬆️  [subir_prioridad_archivo] Cambiando prioridades...`);
    logger.info(`   Hash: ${torrentHash}`);
    logger.info(`   File ID a priorizar: ${fileId}`);
    logger.info(`   Host: ${this.host}`);

    // Obtener archivos una sola vez
    const archivos = await this.obtenerArchivosDeTorrent(torrentHash);
    logger.info(`   Total archivos: ${archivos.length}`);

    // Crear array de promesas para cambiar prioridades en paralelo
    const prioridadPromises = archivos.map(archivo => {
      const paramsForm = new URLSearchParams();
      paramsForm.append('hash', torrentHash);
      paramsForm.append('id', archivo.id);
      paramsForm.append('priority', archivo.id === fileId ? '7' : '1');

      return this.session.post('/api/v2/torrents/filePrio', paramsForm, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then(response => {
        if (response.status === 200) {
          const prioText = archivo.id === fileId ? 'prioridad 7 (máxima)' : 'prioridad 1';
          logger.info(`   ✓ Archivo ${archivo.id} → ${prioText}`);
          return true;
        } else {
          logger.info(`   ✗ Error archivo ${archivo.id}`);
          return false;
        }
      }).catch(error => {
        logger.info(`   ✗ Error archivo ${archivo.id}: ${error.message}`);
        return false;
      });
    });

    // Ejecutar todas las actualizaciones en paralelo
    await Promise.all(prioridadPromises);
    logger.info(`   ✅ Prioridades actualizadas`);
  }

  /**
   * Obtener URL de stream para un torrent (API externa - deprecado, usar obtenerStreamsLocal)
   */
  async obtenerStreamsDeTorrent(torrentPath, streamApiUrl, streamApiToken, streamApiVerifySsl) {
    logger.info(`\n🎬 [obtener_streams_de_torrent] Obteniendo stream...`);
    logger.info(`   Path: ${torrentPath}`);
    logger.info(`   API URL: ${streamApiUrl}`);
    logger.info(`   Verify SSL: ${streamApiVerifySsl}`);
    logger.info(`   Token: ${streamApiToken?.substring(0, 20)}...`);

    const params = { path: torrentPath };
    logger.info(`   Params JSON: ${JSON.stringify(params)}`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': streamApiToken
    };

    try {
      const axiosConfig = {
        headers,
        timeout: 10000,
        httpsAgent: streamApiVerifySsl ? undefined : new (require('https').Agent)({
          rejectUnauthorized: false
        })
      };

      if (!streamApiVerifySsl) {
        logger.info(`   ⚠️  Verificación SSL deshabilitada`);
      }

      logger.info(`   Enviando POST request...`);
      const response = await axios.post(streamApiUrl, params, axiosConfig);
      logger.info(`   Status code: ${response.status}`);
      const responseText = JSON.stringify(response.data);
      logger.info(`   Response text: ${responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText}`);

      if (response.status === 200) {
        const responseData = response.data;
        logger.info(`   Response JSON: ${JSON.stringify(responseData)}`);
        const streams = responseData.url;

        if (streams) {
          logger.info(`   ✅ Stream obtenido: ${streams}`);
          return streams;
        } else {
          logger.info(`   ❌ Respuesta no contiene 'url'`);
          return null;
        }
      } else {
        logger.info(`   ❌ Error HTTP ${response.status}: ${response.data}`);
        return null;
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        logger.info(`   ❌ Timeout (10s) al conectar con API`);
      } else if (error.response) {
        logger.info(`   ❌ Error HTTP: ${error.response.status}`);
      } else {
        logger.info(`   ❌ Excepción inesperada: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Obtener URL de stream local para un torrent (nuevo método integrado)
   */
  async obtenerStreamsLocal(torrentPath, baseUrl) {
    logger.info(`\n🎬 [obtener_streams_local] Obteniendo stream local...`);
    logger.info(`   Path: ${torrentPath}`);
    logger.info(`   Base URL: ${baseUrl}`);

    const params = { path: torrentPath };

    try {
      logger.info(`   Enviando POST request a servicio local...`);
      const response = await axios.post(`${baseUrl}/video-stream/token`, params, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      logger.info(`   Status code: ${response.status}`);

      if (response.status === 200) {
        const responseData = response.data;
        const streamUrl = responseData.url;

        if (streamUrl) {
          logger.info(`   ✅ Stream local obtenido: ${streamUrl}`);
          return streamUrl;
        } else {
          logger.info(`   ❌ Respuesta no contiene 'url'`);
          return null;
        }
      } else {
        logger.info(`   ❌ Error HTTP ${response.status}: ${response.data}`);
        return null;
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        logger.info(`   ❌ Timeout (10s) al conectar con servicio local`);
      } else if (error.response) {
        logger.info(`   ❌ Error HTTP: ${error.response.status} - ${error.response.data?.error || ''}`);
      } else {
        logger.info(`   ❌ Excepción inesperada: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Obtener información de transferencia y espacio de qBittorrent
   */
  async obtenerInfoTransferencia() {
    // Verificar que tenemos sesión activa
    if (!this.session) {
      logger.warn(`⚠️  Sin sesión activa para obtener info de transferencia`);
      return null;
    }
    
    try {
      const response = await this.session.get('/api/v2/transfer/info');
      
      if (response.status === 200) {
        const info = response.data;
        // Convertir bytes a formato legible
        const formatBytes = (bytes) => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return {
          dlSpeed: formatBytes(info.dl_info_speed),
          upSpeed: formatBytes(info.up_info_speed),
          dlData: formatBytes(info.dl_info_data),
          upData: formatBytes(info.up_info_data),
          freeSpace: formatBytes(info.free_space_on_disk)
        };
      }
      return null;
    } catch (error) {
      logger.info(`Error obteniendo info de transferencia: ${error.message}`);
      return null; // No fallar, solo retornar null
    }
  }
}

module.exports = QBittorrentClient;
