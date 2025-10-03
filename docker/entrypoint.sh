#!/bin/sh
set -e

# Aguarda o banco de dados estar pronto
echo "Waiting for database..."
while ! nc -z db 3306; do
  sleep 1
done
echo "Database is ready."

# Executa as migracoes
alembic upgrade head

# Executa o comando principal do container
exec "$@"