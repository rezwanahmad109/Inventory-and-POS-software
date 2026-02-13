# Deployment Guide

## 1) Backend environment (dotenv)

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill secure values:
   - `JWT_SECRET`
   - `DB_PASSWORD`
   - `ADMIN_PASSWORD`
3. Keep `DB_SYNCHRONIZE=false` in production.

The backend loads `.env` through `@nestjs/config` and validates required values in `backend/src/config/env.validation.ts`.

## 2) Docker local runtime

Start backend + PostgreSQL:

```bash
docker compose --env-file backend/.env up -d --build
```

Stop:

```bash
docker compose down
```

## 3) PM2 (non-container runtime)

```bash
cd backend
npm ci
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

## 4) GitHub Actions CI/CD

Workflow: `.github/workflows/ci-cd.yml`

Pipeline includes:
- backend install/lint/test/build
- Docker build and GHCR push with BuildKit cache
- optional Flutter web build (`flutter build web --release`) when `pubspec.yaml` exists
- SSH production deploy with health-check rollback

Required GitHub secrets for deploy job:
- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_SSH_PORT` (optional, defaults to `22`)
- `PROD_ENV_FILE` (full `.env` content for production server)
- `GHCR_USERNAME`
- `GHCR_PAT` (token with `read:packages`)

## 5) Rollback support

Manual rollback uses the same workflow:
1. Open Actions -> `CI-CD` -> `Run workflow`.
2. Set `deploy_tag` to a previous image tag (commit SHA).
3. Run workflow.

Automatic rollback is also enabled if deployed container health check fails.

## 6) Flutter web hosting options

Build:

```bash
flutter pub get
flutter build web --release
```

Serve with Nginx:
- Use `deploy/nginx/flutter-web.conf`
- Copy `build/web/*` to `/usr/share/nginx/html`

Firebase Hosting:
- Configure `.firebaserc` from `.firebaserc.example`
- Use `firebase.json`
- Deploy with `firebase deploy --only hosting`

Vercel:
- Use `vercel.json`
- Set project output directory to `build/web`
