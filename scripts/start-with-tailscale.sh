#!/bin/sh
set -e

# El contenedor arranca como root (ver Dockerfile: ya no hay `USER nextjs`)
# porque tailscaled necesita root + CAP_NET_ADMIN para modo TUN real. Usamos
# /tmp igual (world-writable) para estado/socket, mas por consistencia con
# coinarb que por necesidad estricta ahora que corremos como root.
mkdir -p /tmp/tailscale
chmod 700 /tmp/tailscale
TS_SOCKET="/tmp/tailscale/tailscaled.sock"
TS_STATE="/tmp/tailscale/tailscaled.state"

# Falla rapido y con un mensaje claro si faltan las credenciales de Headscale,
# en vez de dejar que `tailscale up` caiga al SaaS publico de Tailscale y
# quede colgado esperando auth interactiva por navegador (rompe el healthcheck
# de Fly de forma confusa).
if [ -z "${HEADSCALE_URL}" ] || [ -z "${HEADSCALE_AUTHKEY}" ]; then
  echo "ERROR: HEADSCALE_URL and HEADSCALE_AUTHKEY must both be set (Fly secrets)." >&2
  exit 1
fi

# Arranca tailscaled en background y se une a la red Headscale.
# Modo TUN real (sin --tun=userspace-networking ni --socks5-server): crea una
# interfaz de red real (tailscale0) que el kernel enruta de forma transparente,
# para que `postgres(url, {max:5})` en src/lib/pg/client.ts llegue a
# 100.64.0.1:5432 sin necesitar awareness de SOCKS5 en el codigo de la app.
# Funciona en Fly.io porque cada Fly Machine es su propia microVM Firecracker
# (kernel propio), asi que /dev/net/tun y CAP_NET_ADMIN estan disponibles para
# un proceso root sin flags especiales en fly.toml.
tailscaled --state="${TS_STATE}" --socket="${TS_SOCKET}" &
sleep 2
tailscale --socket="${TS_SOCKET}" up \
    --login-server="${HEADSCALE_URL}" \
    --authkey="${HEADSCALE_AUTHKEY}" \
    --hostname=alphalog-pwa

# Arranca la app Next.js, pero como el usuario no-root `nextjs` (no root):
# tailscaled ya hizo lo que necesitaba de root, el proceso Node de la app no
# necesita ni deberia correr como root. Los archivos de /app ya son
# nextjs:nodejs (--chown en el Dockerfile), asi que el cambio de usuario no
# afecta permisos de lectura/escritura del propio server.js/.next.
exec su nextjs -s /bin/sh -c "node server.js"
