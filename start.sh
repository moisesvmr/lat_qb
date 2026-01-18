#!/bin/bash

# Script de inicio para Stremio Lat-Team Addon v2.0
# Este script verifica los requisitos y inicia el servidor

echo "🎬 Stremio Lat-Team Addon v2.0 - Script de Inicio"
echo "=================================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "   Instálalo con: sudo apt install nodejs npm -y"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js detectado: $NODE_VERSION"

# Verificar FFmpeg
if ! command -v ffprobe &> /dev/null; then
    echo "⚠️  FFmpeg/FFProbe no está instalado"
    echo "   Instalando automáticamente..."
    sudo apt update && sudo apt install ffmpeg -y
    if [ $? -eq 0 ]; then
        echo "✅ FFmpeg instalado correctamente"
    else
        echo "❌ Error instalando FFmpeg. Instálalo manualmente: sudo apt install ffmpeg -y"
        exit 1
    fi
else
    FFPROBE_VERSION=$(ffprobe -version | head -n 1)
    echo "✅ FFmpeg/FFProbe detectado: $FFPROBE_VERSION"
fi

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 no está instalado"
    echo "   ¿Deseas instalarlo? (recomendado para producción) [y/N]"
    read -r INSTALL_PM2
    if [[ "$INSTALL_PM2" =~ ^[Yy]$ ]]; then
        npm install -g pm2
        if [ $? -eq 0 ]; then
            echo "✅ PM2 instalado correctamente"
        else
            echo "❌ Error instalando PM2"
            exit 1
        fi
    fi
fi

# Verificar archivo .env
if [ ! -f .env ]; then
    echo "⚠️  Archivo .env no encontrado"
    if [ -f .env.example ]; then
        echo "   Creando .env desde .env.example..."
        cp .env.example .env
        echo "✅ Archivo .env creado"
        echo "⚠️  IMPORTANTE: Edita el archivo .env con tus configuraciones:"
        echo "   nano .env"
        echo ""
        exit 0
    else
        echo "❌ .env.example no encontrado"
        exit 1
    fi
else
    echo "✅ Archivo .env encontrado"
fi

# Verificar node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencias instaladas"
    else
        echo "❌ Error instalando dependencias"
        exit 1
    fi
else
    echo "✅ Dependencias ya instaladas"
fi

echo ""
echo "=================================================="
echo "🚀 Iniciando servidor..."
echo "=================================================="
echo ""

# Opción de inicio
if command -v pm2 &> /dev/null; then
    echo "Selecciona modo de inicio:"
    echo "  1) PM2 (Producción - recomendado)"
    echo "  2) Node directo (Desarrollo)"
    read -p "Opción [1]: " MODO
    MODO=${MODO:-1}
    
    if [ "$MODO" = "1" ]; then
        # Verificar si ya está corriendo
        if pm2 list | grep -q "stremio-latam"; then
            echo "⚠️  El servidor ya está corriendo"
            read -p "¿Deseas reiniciarlo? [y/N]: " RESTART
            if [[ "$RESTART" =~ ^[Yy]$ ]]; then
                pm2 restart stremio-latam --update-env
                echo "✅ Servidor reiniciado"
            fi
        else
            pm2 start src/index.js --name stremio-latam
            echo "✅ Servidor iniciado con PM2"
        fi
        
        echo ""
        echo "Ver logs en tiempo real:"
        echo "  pm2 logs stremio-latam"
        echo ""
        echo "Comandos útiles:"
        echo "  pm2 status          - Ver estado"
        echo "  pm2 stop stremio-latam    - Detener"
        echo "  pm2 restart stremio-latam - Reiniciar"
        echo "  pm2 monit           - Monitor"
        
        # Preguntar si quiere ver logs
        echo ""
        read -p "¿Ver logs ahora? [Y/n]: " SHOW_LOGS
        SHOW_LOGS=${SHOW_LOGS:-Y}
        if [[ "$SHOW_LOGS" =~ ^[Yy]$ ]]; then
            pm2 logs stremio-latam
        fi
    else
        echo "Iniciando en modo desarrollo..."
        node src/index.js
    fi
else
    echo "Iniciando con Node.js..."
    node src/index.js
fi
