#!/usr/bin/env bash
# Eigener Server mit fester IP für API-Sports (Rene, 26.10.2026).
# API-Sports sperrt die geteilten IPs von Vercel. Dieser Server leitet die
# Abfragen der App weiter, sodass API-Sports nur noch seine feste IP sieht.
#
# Für Ubuntu/Debian. Auf dem Server als root ausführen:
#   curl -fsSL https://raw.githubusercontent.com/ReneM18/Pooltipp2/main/scripts/api-proxy/einrichten.sh | bash
#
# Installiert Caddy (Webserver mit automatischem HTTPS), richtet die
# Weiterleitung ein und zeigt am Ende die zwei Werte für Vercel
# (API_SPORTS_PROXY_URL, API_SPORTS_PROXY_TOKEN). Erneut ausführen ist
# harmlos; der Token bleibt dann gleich.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen (oder mit sudo)." >&2
  exit 1
fi

# Feste IPv4 des Servers → Adresse über sslip.io (1.2.3.4 → 1-2-3-4.sslip.io),
# damit HTTPS ohne eigene Domain klappt.
IP="$(curl -4 -fsS https://api.ipify.org)"
DOMAIN="${IP//./-}.sslip.io"

TOKEN_FILE=/etc/caddy/api-proxy-token
mkdir -p /etc/caddy
if [ ! -s "$TOKEN_FILE" ]; then
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
fi
TOKEN="$(cat "$TOKEN_FILE")"

if ! command -v caddy >/dev/null 2>&1; then
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# Pfad → API-Sports-Host (wie in lib/live/providers/apiSports.ts).
routes=""
for pair in football:v3.football.api-sports.io \
            hockey:v1.hockey.api-sports.io \
            basketball:v1.basketball.api-sports.io \
            american-football:v1.american-football.api-sports.io \
            handball:v1.handball.api-sports.io; do
  name="${pair%%:*}"
  host="${pair#*:}"
  routes+="
		handle_path /${name}/* {
			reverse_proxy https://${host} {
				header_up Host {upstream_hostport}
				header_up -X-Proxy-Token
			}
		}"
done

cat > /etc/caddy/Caddyfile <<CADDY
# Erzeugt von scripts/api-proxy/einrichten.sh (Pooltipp2).
${DOMAIN} {
	route {
		# Nur die App (mit Token) darf durch.
		@fremd not header X-Proxy-Token ${TOKEN}
		respond @fremd 403
${routes}
		respond 404
	}
}
CADDY

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo
echo "Fertig. Diese zwei Werte bei Vercel eintragen"
echo "(Settings → Environment Variables, dann neu deployen):"
echo
echo "  API_SPORTS_PROXY_URL   = https://${DOMAIN}"
echo "  API_SPORTS_PROXY_TOKEN = ${TOKEN}"
echo
echo "Feste IP dieses Servers (für den API-Sports-Support): ${IP}"
