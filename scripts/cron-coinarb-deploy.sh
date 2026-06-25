#!/bin/bash
# AlphaLog cron — auto-deploy de coinarb-50x.
#
# Cada vez que se ejecuta:
#   1. Fetch la última versión de origin/main del repo (clona la primera vez).
#   2. Compara el HEAD con el último SHA deployado (persistido en /var/coinarb-repo/.last-deployed-sha).
#   3. Si hay commits nuevos Y tocan coinarb/**, corre `flyctl deploy --app coinarb-50x --remote-only`.
#   4. Persiste el nuevo SHA tras un deploy exitoso.
#
# El secret FLY_API_TOKEN_COINARB debe estar set como Fly secret en alphalog-cron:
#   flyctl secrets set FLY_API_TOKEN_COINARB="FlyV1 fm2_..." --app alphalog-cron
#
# Diseño: el repo es público; el clone no requiere auth. flyctl usa el token
# del env var FLY_API_TOKEN para autenticar al deploy.

set -euo pipefail

REPO=/var/coinarb-repo
SHA_FILE="$REPO/.last-deployed-sha"
REPO_URL="https://github.com/rivejova2015-afk/alphalog-pwa.git"

if [ -z "${FLY_API_TOKEN_COINARB:-}" ]; then
  echo "[coinarb-deploy] ERROR: FLY_API_TOKEN_COINARB no está set. Aborto."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[coinarb-deploy] ERROR: git no instalado en este container."
  exit 1
fi
if ! command -v flyctl >/dev/null 2>&1; then
  echo "[coinarb-deploy] ERROR: flyctl no instalado en este container."
  exit 1
fi

if [ ! -d "$REPO/.git" ]; then
  echo "[coinarb-deploy] primer run — clonando $REPO_URL en $REPO"
  mkdir -p "$REPO"
  git clone --depth=50 "$REPO_URL" "$REPO"
fi

cd "$REPO"
git fetch --quiet origin main
git reset --hard --quiet origin/main

NEW_SHA=$(git rev-parse HEAD)
LAST_SHA="$(cat "$SHA_FILE" 2>/dev/null || echo "")"

if [ "$NEW_SHA" = "$LAST_SHA" ]; then
  echo "[coinarb-deploy] no new commits ($NEW_SHA), skip"
  exit 0
fi

# Si tenemos un LAST_SHA, verificamos que los commits nuevos toquen coinarb/.
# Si NO hay LAST_SHA (primera ejecución), deployamos directo.
if [ -n "$LAST_SHA" ]; then
  if git diff --quiet "$LAST_SHA" "$NEW_SHA" -- coinarb/ ; then
    echo "[coinarb-deploy] commits nuevos sin cambios en coinarb/, skip (LAST=$LAST_SHA NEW=$NEW_SHA)"
    echo "$NEW_SHA" > "$SHA_FILE"
    exit 0
  fi
fi

echo "[coinarb-deploy] deploying $LAST_SHA -> $NEW_SHA"
cd "$REPO/coinarb"
FLY_API_TOKEN="$FLY_API_TOKEN_COINARB" flyctl deploy \
  --app coinarb-50x \
  --remote-only

echo "$NEW_SHA" > "$SHA_FILE"
echo "[coinarb-deploy] success ($NEW_SHA)"
