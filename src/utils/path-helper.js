const path = require('path');

/**
 * Normaliza un path eliminando slashes finales
 * @param {string} p - Path a normalizar
 * @returns {string} - Path normalizado
 */
function normalizePath(p) {
  if (!p) return '';
  return p.replace(/\/+$/, '');
}

/**
 * Une paths de forma segura, normalizando antes
 * @param {...string} paths - Paths a unir
 * @returns {string} - Path resultante
 */
function joinPaths(...paths) {
  const normalized = paths.map(p => normalizePath(p));
  return path.join(...normalized);
}

/**
 * Valida que un archivo tenga una extensión permitida
 * @param {string} filePath - Path del archivo
 * @param {string[]} allowedExtensions - Extensiones permitidas
 * @returns {boolean}
 */
function hasValidExtension(filePath, allowedExtensions) {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtensions.includes(ext);
}

module.exports = {
  normalizePath,
  joinPaths,
  hasValidExtension
};
