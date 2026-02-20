# Deployment Guide

## 1) Environment files

1. Backend runtime:
   - Copy `backend/.env.example` to `backend/.env`
   - Set secure values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD`
2. Compose/runtime variables:
   - Copy `.env.example` to `.env`
   - Set image tags, ports, CORS origins, and TLS cert path

## 2) Local Docker Compose

Starts PostgreSQL, migration runner, backend API, and Flutter web (Nginx):

```bash
docker compose --env-file .env up -d --build
```

Services:
- `db`: PostgreSQL 16
- `migrate`: applies `backend/sql/migrations/*_up.sql` automatically
- `backend`: NestJS API (`/api/docs`)
- `frontend`: Nginx serving Flutter web assets and reverse proxying `/api/*` to backend

Stop:

```bash
docker compose down
```

## 3) Production Compose (TLS)

`docker-compose.prod.yml` expects prebuilt/pushed images:
- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`

TLS:
- Mount certs directory to `/etc/nginx/certs`
- Required files:
  - `/etc/nginx/certs/fullchain.pem`
  - `/etc/nginx/certs/privkey.pem`
- TLS Nginx config: `deploy/nginx/flutter-web-tls.conf`

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## 4) Flutter web build behavior

Frontend Dockerfile: `deploy/docker/frontend.Dockerfile`

- If `pubspec.yaml` exists, it runs:
  - `flutter pub get`
  - `flutter build web --release`
- If missing, it serves a placeholder page so container startup still succeeds.

Set API base URL at build time:

```bash
docker build -f deploy/docker/frontend.Dockerfile --build-arg API_BASE_URL=/api .
```

## 5) Reverse proxy behavior

Nginx config (`deploy/nginx/flutter-web.conf` and TLS variant):
- Serves Flutter web app from `/usr/share/nginx/html`
- Proxies `/api/*` to backend and strips `/api` prefix
- Proxies `/api/docs` to backend Swagger docs

## 6) PM2 (optional non-container backend)

```bash
cd backend
npm ci
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```
