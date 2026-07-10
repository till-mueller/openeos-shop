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
