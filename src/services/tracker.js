const logger = require('../utils/logger');

const axios = require('axios');

/**
 * Obtener información del usuario del tracker
 */
async function obtenerInfoUsuario(token) {
  try {
    const url = `https://lat-team.com/api/user?api_token=${token}`;
    //logger.info(`[DEBUG] Consultando tracker con URL: ${url.substring(0, 60)}...`);
    const response = await axios.get(url);
    
    if (response.status === 200) {
      logger.info(`✅ Info de usuario obtenida correctamente`);
      //logger.info(`[DEBUG] Respuesta del tracker: ${JSON.stringify(response.data, null, 2)}`);
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error obteniendo info del usuario: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

module.exports = {
  obtenerInfoUsuario
};
