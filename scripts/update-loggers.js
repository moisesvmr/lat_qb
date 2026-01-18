#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Archivos a procesar
const files = [
  'src/index.js',
  'src/services/cache.js',
  'src/services/database.js',
  'src/services/qbittorrent.js',
  'src/services/streaming.js',
  'src/services/streaming-helpers.js',
  'src/services/torrent-parser.js',
  'src/services/tracker.js',
  'src/services/video-streaming.js'
];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Reemplazar console.log por logger.info/warn/error según contexto
  content = content.replace(/console\.log\(`❌/g, 'logger.error(`❌');
  content = content.replace(/console\.log\(`⚠️/g, 'logger.warn(`⚠️');
  content = content.replace(/console\.log\(`✅/g, 'logger.info(`✅');
  content = content.replace(/console\.log\(`✓/g, 'logger.info(`✓');
  content = content.replace(/console\.log\(/g, 'logger.info(');

  // Agregar import de logger si no existe y si se hicieron cambios
  if (content !== original && !content.includes("require('./utils/logger')") && !content.includes('require("./utils/logger")')) {
    // Buscar la primera línea con require
    const lines = content.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('require(') && !lines[i].trim().startsWith('//')) {
        insertIndex = i;
        break;
      }
    }
    
    // Calcular la ruta relativa para el logger
    const depth = file.split('/').length - 2; // -1 por el archivo mismo, -1 más para src
    const relativePath = '../'.repeat(depth) + 'utils/logger';
    const loggerImport = `const logger = require('${relativePath}');\n`;
    
    lines.splice(insertIndex, 0, loggerImport);
    content = lines.join('\n');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`⏭️  Skipped: ${file} (no changes)`);
  }
});

console.log('\n✅ All files processed!');
