#!/usr/bin/env sh
set -e

echo "Waiting for database..."

# Extrai host/port do DATABASE_URL (funciona p/ aiomysql e pymysql)
DB_HOST_FROM_URL=$(python3 - <<'PY'
import os, urllib.parse as u
url = os.environ.get('DATABASE_URL', '')
# normaliza driver p/ urllib entender
url = url.replace('+aiomysql', '+pymysql')
p = u.urlparse(url)
print(p.hostname or '')
PY
)

DB_PORT_FROM_URL=$(python3 - <<'PY'
import os, urllib.parse as u
url = os.environ.get('DATABASE_URL', '')
url = url.replace('+aiomysql', '+pymysql')
p = u.urlparse(url)
print(p.port or 3306)
PY
)

DB_HOST="${DB_HOST:-${DB_HOST_FROM_URL:-db}}"
DB_PORT="${DB_PORT:-${DB_PORT_FROM_URL:-3306}}"

# Permite pular a espera se quiser (export WAIT_FOR_DB=0 no .env)
if [ "${WAIT_FOR_DB:-1}" = "1" ]; then
  echo "Waiting for ${DB_HOST}:${DB_PORT}..."
  for i in $(seq 1 60); do
    if nc -z "${DB_HOST}" "${DB_PORT}" >/dev/null 2>&1; then
      echo "Database is reachable."
      break
    fi
    echo "(${i}/60) still waiting..."
    sleep 2
  done
fi

exec "$@"
