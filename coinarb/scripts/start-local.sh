#!/bin/sh
set -e

# Variante local de start-with-tailscale.sh: cuando el contenedor ya esta en
# la misma red Docker que lattice-server-postgres-1 (algo-runner lo levanta
# asi), no hace falta el tunel de Tailscale/Headscale en absoluto -- Postgres
# se alcanza directo por el nombre de host "postgres" de esa red.
if [ -z "${ALPHALOG_PG_URL}" ]; then
  echo "ERROR: ALPHALOG_PG_URL debe estar seteada (conexion directa a Postgres, sin Tailscale)." >&2
  exit 1
fi

exec node dist/core/index.js
