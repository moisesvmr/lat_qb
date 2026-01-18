# 🎬 Stremio Lat-Team Addon (Versión Unificada)

Addon de Stremio para streaming de torrents desde [Lat-Team](https://lat-team.com) con integración de qBittorrent **y servidor de streaming integrado**.

> **🆕 Versión 2.1**: Logging profesional, validación de configuración, rate limiting y mejoras de seguridad.
> 
> **🆕 Versión 2.0**: Servidor de video streaming integrado. Ya no necesitas un servidor separado como `qb_stream`.

## ✨ Características Principales

### 🎯 Funcionalidades Core
- **Búsqueda Inteligente**: Encuentra torrents automáticamente usando IMDB o TMDB
- **Streaming Instantáneo**: Reproduce directamente desde qBittorrent sin esperar descarga completa
- **Descarga Secuencial**: Los archivos se descargan en orden para reproducción inmediata
- **Multi-Calidad**: Muestra todas las calidades disponibles (4K, 1080p, 720p, etc.)
- **🆕 Streaming Integrado**: Servidor de video con tokens temporales y cache de FFProbe incluido

### 📊 Sistema de Cache
- **Cache con Estadísticas**: Monitorea hit/miss rate en tiempo real
- **Indicador Visual**: Emoji ⚡ indica torrents ya descargados en cache
- **Auto-renovación**: El cache se extiende automáticamente al acceder
- **🆕 Cache FFProbe**: Persistencia de validaciones de archivos multimedia

### 📺 Información en Tiempo Real
- **Stats del Tracker**: Ratio, buffer, uploaded, downloaded
- **Stats de qBittorrent**: Velocidad de descarga/subida, espacio libre
- **Info Detallada**: Códec, HDR, audio, idiomas, seeders/leechers

### 🎬 Servidor de Streaming (Nuevo)
- **Tokens Temporales**: URLs de streaming de un solo uso con expiración automática
- **Range Requests**: Soporte completo para reproducción con seek
- **Validación FFProbe**: Verificación inteligente de archivos listos para streaming
- **Multi-Volumen**: Búsqueda automática en múltiples rutas configuradas
- **Formatos Soportados**: MP4, WebM, OGV, MKV, AVI, M4V, MOV

---

## 🚀 Guía de Instalación y Despliegue

### 📋 Requisitos Previos

```bash
# Node.js 18 o superior
node --version  # v18.0.0+

# PM2 para producción (opcional pero recomendado)
npm install -g pm2

# FFmpeg/FFProbe para validación de archivos (NUEVO)
sudo apt update && sudo apt install ffmpeg -y
ffprobe -version

# qBittorrent con WebUI habilitado
# Cuenta activa en Lat-Team (https://lat-team.com)
# API Key de TMDB (https://www.themoviedb.org/settings/api)
```

### 📥 Paso 1: Clonar e Instalar

```bash
# Clonar repositorio
git clone https://github.com/moisesvmr/s_lt_addon.git
cd s_lt_addon

# Instalar dependencias
npm install
```

### ⚙️ Paso 2: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus datos
nano .env
```

**Variables importantes:**
```env
# Tokens (OBLIGATORIOS)
LATAM_TOKEN=tu_token_lat_team
TMDB_KEY=tu_api_key_tmdb
ADDON_KEY=clave_secreta_unica
TORRENT_API_KEY=tu_api_key_torrents

# Dominio público (para Stremio)
DOMAIN=http://tu-servidor.com:5000

# qBittorrent
QBIT_HOST=http://localhost:8083
QBIT_USER=admin
QBIT_PASS=tu_password
QB_KEEP_ALIVE_INTERVAL=1800

# Retry Configuration
MAX_RETRIES=10   #numero maximo de reintentos para operaciones fallidas
RETRY_DELAY=3   #tiempo de espera entre reintentos en segundos

# Cache Configuration (in seconds) 
CACHE_DURATION=3600  #duracion del cache en segundos

# Directorios de Torrents (IMPORTANTE)
TORRENT_MOVIES_PATH=/datos/videosc/movies
TORRENT_SERIES_PATH=/datos/videosc/series

# Video Streaming (NUEVO - Integrado)
# NOTA: Los volúmenes de streaming se toman automáticamente de TORRENT_MOVIES_PATH y TORRENT_SERIES_PATH
# Solo configura VOLUMES_PATH si necesitas agregar rutas adicionales
# VOLUMES_PATH=/ruta/adicional1,/ruta/adicional2  (opcional)
FFPROBE_CACHE_FILE=./ffprobe_cache.json

# Server Configuration
PORT=4000  #puerto en el que se ejecuta el servidor
HOST=0.0.0.0  #direccion en la que se ejecuta el servidor
LOG_LEVEL=info  #niveles: trace, debug, info, warn, error, fatal
NODE_ENV=development  #development o production

```

**⚠️ Nota importante**: Ya **NO** necesitas las variables `STREAM_API_URL`, `STREAM_API_TOKEN` ni `STREAM_API_VERIFY_SSL`. El streaming ahora es interno.

### 🔧 Paso 3: Ejecutar con PM2 (Producción)

#### Instalación básica:

```bash
# Iniciar con PM2
pm2 start src/index.js --name stremio-latam

# Ver logs en tiempo real
pm2 logs stremio-latam

# Ver estado
pm2 status

# Auto-inicio en reinicio del sistema
pm2 startup
pm2 save
```

#### Comandos útiles:

```bash
# Reiniciar servidor
pm2 restart stremio-latam

# Detener servidor
pm2 stop stremio-latam

# Ver información detallada
pm2 show stremio-latam

# Monitoreo en tiempo real
pm2 monit
```

### 🎯 Paso 4: Instalar en Stremio

1. Abre Stremio
2. Ve a **Addons**
3. Ingresa la URL: `http://tu-servidor.com:5000/TU_ADDON_KEY/manifest.json`
4. Haz clic en **Install**

---

## 📡 API Endpoints

### Endpoints del Addon

#### GET `/:addon_key/manifest.json`
Manifiesto del addon para Stremio.

#### GET `/:addon_key/stream/:type/:id.json`
Obtiene streams disponibles para películas o series.

#### GET `/:addon_key/rd1/:id`
Redirección para películas (genera URL de streaming).

#### GET `/:addon_key/rd2/:season/:episode/:id`
Redirección para episodios de series.

### Endpoints de Video Streaming (Nuevos)

#### POST `/video-stream/token`
Genera un token temporal para streaming.

**Body:**
```json
{
  "path": "/ruta/completa/al/archivo.mp4"
}
```

**Respuesta:**
```json
{
  "url": "http://servidor:5000/video-stream/TOKEN",
  "token": "TOKEN_GENERADO",
  "inactive_expires_in": 3600,
  "file_size": 1234567890
}
```

#### GET `/video-stream/:token`
Endpoint público para streaming del archivo.

**Headers opcionales:**
```http
Range: bytes=0-1023
```

#### GET `/health`
Health check del servidor con información del sistema.

**Respuesta:**
```json
{
  "status": "healthy",
  "qbittorrent": "connected",
  "streaming": {
    "active_tokens": 5,
    "cache_entries": 42
  },
  "timestamp": 1735084800
}
```

---

## 📝 Logs

Los logs muestran:
- ✅ Conexiones exitosas a qBittorrent
- 🎬 Tokens de streaming generados
- ⚡ Hits de cache (torrents y FFProbe)
- 🔍 Búsquedas de torrents en Lat-Team
- 📊 Estadísticas de acceso
- 🗑️ Limpieza automática de tokens inactivos
- ⚠️ Advertencias y errores

**Ver logs con PM2:**
```bash
pm2 logs stremio-latam --lines 100
```

---

## 🛠️ Tecnologías

- **[Fastify](https://www.fastify.io/)** - Framework web de alto rendimiento
- **[Axios](https://axios-http.com/)** - Cliente HTTP
- **[qBittorrent API](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1))** - Control de torrents
- **[FFmpeg/FFProbe](https://ffmpeg.org/)** - Validación de archivos multimedia
- **[TMDB API](https://www.themoviedb.org/documentation/api)** - Conversión IMDB↔TMDB
- **[Lat-Team API](https://lat-team.com)** - Tracker de torrents

---

## 🐛 Troubleshooting

### Error: `ffprobe: command not found`
```bash
sudo apt install ffmpeg -y
```

### Error: Puerto en uso
Cambiar `PORT` en `.env`:
```env
PORT=3000
```

### Error: No se puede conectar a qBittorrent
Verificar que qBittorrent está corriendo y el WebUI está habilitado.

### Ver logs detallados
```bash
pm2 logs stremio-latam --lines 200
```

### Reiniciar completamente
```bash
pm2 restart stremio-latam --update-env
```

---

## 🆕 Cambios en la Versión 2.0

### ✅ Lo Nuevo
- ✨ Servidor de streaming integrado (ya no necesitas `qb_stream`)
- 🎬 Tokens temporales con expiración automática
- 📦 Cache inteligente de FFProbe
- 🔄 Limpieza automática de recursos
- 💾 Graceful shutdown con persistencia de cache
- 🏥 Health check endpoint

### 🗑️ Removido/Deprecado
- ❌ Variables `STREAM_API_URL`, `STREAM_API_TOKEN`, `STREAM_API_VERIFY_SSL` ya no son necesarias
- ❌ No necesitas un servidor separado para streaming

### 📝 Migración desde v1.x
Si vienes de una versión anterior:
1. Actualiza tu `.env` siguiendo el nuevo `.env.example`
2. Agrega las nuevas variables `VOLUMES_PATH` y `FFPROBE_CACHE_FILE`
3. Instala FFmpeg: `sudo apt install ffmpeg -y`
4. Elimina las variables antiguas de STREAM_API
5. Reinicia el servidor

---

## ⭐ Agradecimientos

- [Stremio](https://www.stremio.com/) - Plataforma de streaming
- [Lat-Team](https://lat-team.com) - Tracker de torrents
- Comunidad de desarrolladores de addons de Stremio

---

**Desarrollado con ❤️ para la comunidad de Stremio | Versión Unificada 2.0**
