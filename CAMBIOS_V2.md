# 🎯 Fusión de Proyectos: s_lt_addon + qb_stream

## 📝 Resumen de Cambios

Se han fusionado exitosamente los proyectos **s_lt_addon** y **qb_stream** en un servidor unificado.

## ✅ Cambios Realizados

### 1. Nuevo Servicio de Video Streaming
- **Archivo creado**: `src/services/video-streaming.js`
- **Funcionalidades**:
  - Generación de tokens temporales para streaming
  - Cache inteligente con FFProbe
  - Soporte para Range Requests (seek en videos)
  - Validación automática de archivos multimedia
  - Limpieza automática de tokens inactivos
  - Búsqueda en múltiples volúmenes

### 2. Actualización del Servidor Principal (`src/index.js`)
- ✅ Importación del servicio de video streaming
- ✅ Inicialización del servicio al arrancar
- ✅ Nuevos endpoints:
  - `POST /video-stream/token` - Genera token de streaming
  - `GET /video-stream/:token` - Streaming con soporte Range
  - `GET /health` - Health check con estadísticas
- ✅ Graceful shutdown con persistencia de cache
- ✅ Limpieza periódica de tokens cada 60 segundos
- ✅ Uso de servicio local en lugar de API externa

### 3. Actualización de qBittorrent Service (`src/services/qbittorrent.js`)
- ✅ Nuevo método `obtenerStreamsLocal()` para usar el servicio integrado
- ✅ Método antiguo `obtenerStreamsDeTorrent()` marcado como deprecado

### 4. Actualización de package.json
- ✅ Versión incrementada a 2.0.0
- ✅ Descripción actualizada
- ✅ Nueva dependencia: `@fastify/static`
- ✅ Keywords actualizados

### 5. Variables de Entorno (.env.example)
- ✅ Configuración simplificada:
  - `VOLUMES_PATH` se construye **automáticamente** desde `TORRENT_MOVIES_PATH` y `TORRENT_SERIES_PATH`
  - Solo necesitas configurar `VOLUMES_PATH` si quieres agregar rutas adicionales
  - `FFPROBE_CACHE_FILE` - Archivo de cache para FFProbe
- ✅ Variables deprecadas marcadas:
  - `STREAM_API_URL` (ya no necesaria)
  - `STREAM_API_TOKEN` (ya no necesaria)
  - `STREAM_API_VERIFY_SSL` (ya no necesaria)

### 6. Documentación (README.md)
- ✅ Completamente actualizado con nueva arquitectura
- ✅ Requisito de FFmpeg agregado
- ✅ Documentación de nuevos endpoints
- ✅ Sección de troubleshooting
- ✅ Guía de migración desde v1.x
- ✅ Cambios en la versión 2.0 documentados

## 🎬 Características del Servidor de Streaming Integrado

### Tokens Temporales
- URLs de un solo uso con expiración automática (1 hora de inactividad)
- Limpieza automática cada 60 segundos

### Cache Inteligente
- Validación con FFProbe antes de servir archivos
- Persistencia en disco (`ffprobe_cache.json`)
- Evita re-validaciones innecesarias

### Streaming Robusto
- Soporte completo para Range Requests
- Manejo de seek en videos
- Múltiples formatos: MP4, WebM, OGV, MKV, AVI, M4V, MOV

### Multi-Volumen
- Búsqueda automática en múltiples rutas configuradas
- Útil para diferentes discos o montajes

## 🔄 Flujo de Trabajo

1. **Addon solicita stream** → `rd1/:id` o `rd2/:season/:episode/:id`
2. **Torrent se agrega a qBittorrent** (si no existe)
3. **Se obtiene la ruta del archivo** desde qBittorrent
4. **Se genera token temporal** → `POST /video-stream/token`
5. **Se retorna URL de streaming** → `GET /video-stream/:token`
6. **Stremio reproduce el video** con soporte para seek

## 📦 Ventajas de la Unificación

✅ **Un solo servidor** en lugar de dos
✅ **Mejor rendimiento** - Sin latencia entre servicios
✅ **Menor complejidad** - Configuración más simple
✅ **Menos recursos** - Un solo proceso PM2
✅ **Comunicación local** - No hay llamadas HTTP externas
✅ **Más fácil de desplegar** - Todo en un repositorio

## 🚀 Para Empezar

```bash
# 1. Clonar el repositorio
git clone https://github.com/moisesvmr/s_lt_addon.git
cd s_lt_addon

# 2. Instalar dependencias
npm install

# 3. Instalar FFmpeg
sudo apt install ffmpeg -y

# 4. Configurar .env
cp .env.example .env
nano .env

# 5. Iniciar con PM2
pm2 start src/index.js --name stremio-latam
pm2 logs stremio-latam
```

## 📊 Endpoints Nuevos

### POST /video-stream/token
Genera token para streaming
```json
Request: { "path": "/ruta/completa/archivo.mp4" }
Response: { "url": "http://...", "token": "...", "inactive_expires_in": 3600, "file_size": 123456 }
```

### GET /video-stream/:token
Streaming del archivo con soporte Range

### GET /health
Health check del sistema
```json
{
  "status": "healthy",
  "qbittorrent": "connected",
  "streaming": { "active_tokens": 5, "cache_entries": 42 },
  "timestamp": 1735084800
}
```

## ⚠️ Migración desde v1.x

Si tienes una versión anterior instalada:

1. **Actualizar el código**: `git pull origin main`
2. **Instalar dependencias**: `npm install`
3. **Instalar FFmpeg**: `sudo apt install ffmpeg -y`
4. **Actualizar .env**:
   - Agregar `VOLUMES_PATH` y `FFPROBE_CACHE_FILE`
   - Eliminar o comentar `STREAM_API_*`
5. **Reiniciar**: `pm2 restart stremio-latam --update-env`

## 🎉 Resultado

Ahora tienes un **servidor único y optimizado** que maneja:
- ✅ Addon de Stremio
- ✅ Búsqueda en Lat-Team
- ✅ Control de qBittorrent
- ✅ Streaming de video
- ✅ Cache inteligente
- ✅ Tokens temporales

Todo trabajando en el mismo servidor y puerto!
