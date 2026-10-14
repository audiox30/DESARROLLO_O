#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/server"

echo "======================================================================="
echo "         GRUPO JAMA - CONTROL DE VACACIONES (MACOS / LAN)"
echo "              Desarrollo Organizacional y TI"
echo "======================================================================="
echo ""
PORT=$(grep "^PORT=" "$DIR/server/.env" 2>/dev/null | cut -d '=' -f2 | tr -d ' \r' || echo "5001")
if [ -z "$PORT" ]; then PORT=5001; fi

echo "Iniciando servidor web unificado en http://localhost:$PORT..."
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado o no se encuentra en el PATH."
    echo "💡 Puedes instalarlo ejecutando: brew install node"
    exit 1
fi

node src/app.js
