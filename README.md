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
