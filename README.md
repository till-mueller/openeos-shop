# OpenEOS Shop

Öffentlicher Online-Shop für einzelne OpenEOS-Veranstaltungen (`/[eventId]`). Gäste durchstöbern das Produktangebot einer Veranstaltung, legen Artikel in den Warenkorb und schließen den Kauf über die Checkout-Seite (inkl. PayPal-Rückkehr-Flow unter `/[eventId]/checkout/return`) ab.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19 + Untitled UI Icons
- **State Management:** TanStack Query + Zustand
- **Zahlung:** PayPal
- **Icons:** `@openeos/pos-icons`

## Setup

```bash
# Dependencies installieren
pnpm install

# Development Server starten (Port 3004)
pnpm dev

# Production Build
pnpm build
pnpm start

# Linting
pnpm lint
```

Der Dev-Server läuft standardmäßig auf [http://localhost:3004](http://localhost:3004).

## Docker

```bash
docker compose up -d --build
```

### Airgapped / Self-Hosted Deployment

For a closed network (no Traefik, no ACME, no public DNS) use `docker-compose.airgap.yml`:

```bash
docker pull ghcr.io/openeos-project/openeos-shop:latest
docker save -o openeos-shop.tar ghcr.io/openeos-project/openeos-shop:latest
# copy openeos-shop.tar to the offline host, then:
docker load -i openeos-shop.tar
NEXT_PUBLIC_API_URL=http://<api-host>:3000/api docker compose -f docker-compose.airgap.yml up -d
```

`NEXT_PUBLIC_API_URL` is normally inlined into the client bundle at build time, but the published image bakes a sentinel token instead of a real domain — `docker-entrypoint.sh` rewrites it to the runtime value above on every container start, so the same pulled image works against any api host without a rebuild.

## Automatisches Deployment

Nach jedem erfolgreichen Image-Build auf `main` (Workflow `.github/workflows/build-deploy.yaml`, Job `deploy`) kann automatisch auf den Produktionsserver deployed werden. Der Deploy-Job ist standardmäßig deaktiviert und muss explizit aktiviert werden.

**Aktivieren:** Repository-Variable `DEPLOY_ENABLED` auf `true` setzen (Settings → Secrets and variables → Actions → Variables).

**Benötigte Variables:**

| Variable | Beschreibung |
|----------|--------------|
| `DEPLOY_ENABLED` | `true` aktiviert den Deploy-Job, sonst wird er übersprungen |
| `DEPLOY_PATH` | Optional — Compose-Verzeichnis auf dem Server (Default: `/srv/docker/<repo-name>`) |
| `DEPLOY_SERVICE` | Name des zu aktualisierenden Compose-Service |

**Benötigte Secrets:**

| Secret | Beschreibung |
|--------|--------------|
| `DEPLOY_HOST` | Hostname/IP des Produktionsservers |
| `DEPLOY_USER` | SSH-Benutzer |
| `DEPLOY_SSH_KEY` | Privater SSH-Key für den Zugriff |
| `DEPLOY_PORT` | (optional) SSH-Port, Standard: `22` |

Der Deploy-Job verbindet sich per SSH auf den Server und führt dort `docker compose pull` + `docker compose up -d` für den konfigurierten Service aus, gefolgt von `docker image prune -f`.
