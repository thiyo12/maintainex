# Maintainex - Full Rebuild Guide

This archive contains everything needed to rebuild and deploy Maintainex from scratch.

## Contents

```
maintainex-full-backup-YYYY-MM-DD.tar.gz
├── code/          # Full Next.js source code (Part 1 - Frontend + Backend)
├── database/      # PostgreSQL database dump (Part 2a - Database)
├── uploads/       # Uploaded service/industry images (Part 2b - Assets)
├── envs/          # All environment variable files (Part 2c - Config)
└── docker/        # Dockerfile and deployment configs
```

---

## Rebuild Steps

### Step 1: Extract the archive
```bash
tar -xzf maintainex-full-backup-YYYY-MM-DD.tar.gz
cd maintainex-code
```

### Step 2: Restore the database
```bash
# Option A: On Dokploy/Docker Swarm
# 1. Deploy PostgreSQL container first (Dokploy will handle this)
# 2. Restore the dump:
cat ../database/maintainex-db-dump.sql | docker exec -i maintainex-db-container psql -U postgres -d postgres

# Option B: Local PostgreSQL
createdb maintainex
psql -d maintainex < ../database/maintainex-db-dump.sql
```

### Step 3: Set up environment variables
```bash
# Copy production env and edit with your values
cp ../envs/production.env .env
# Edit .env with correct database URL, secrets, etc.
```

### Step 4: Restore uploaded files
```bash
mkdir -p public/uploads
cp -r ../uploads/* public/uploads/
```

### Step 5: Build and deploy

#### Option A: Docker (Recommended for production)
```bash
docker build -t maintainex:latest .
docker run -d -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/public/uploads:/app/public/uploads \
  maintainex:latest
```

#### Option B: Dokploy Deployment
1. Create new project in Dokploy
2. Set env vars from `envs/production.env`
3. Point to GitHub repo: `git@github.com:thiyo12/maintainex.git`
4. Dockerfile builds automatically
5. Add volume mount: `/app/public/uploads` → persistent storage
6. Deploy

#### Option C: Direct Node.js (Development)
```bash
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npm run build
npm start
```

### Step 6: Verify the deployment
```bash
curl http://localhost:3000
# Should return HTTP 200 with HTML
```

---

## Key Configuration Values

| Setting | Value |
|---------|-------|
| Database User | postgres |
| Database Password | *** (stored in VPS environment variables) |
| Database Name | postgres |
| Server IP | 147.93.106.54 |
| Dokploy URL | http://147.93.106.54:3000 |
| Dokploy Login | *** (stored in VPS environment variables) |
| Domain | maintainex.lk |
| Cloudflare SSL | Full (not Full Strict) |

## If deploying on a NEW server (fresh VPS)

### 1. Install Docker & Dokploy
```bash
curl -fsSL https://get.docker.com | sh
# Then install Dokploy via their web UI at http://YOUR_SERVER_IP:3000
```

### 2. Set up DNS
- Point `maintainex.lk` A record to your new server IP
- Cloudflare: Proxy (orange cloud), SSL: Full

### 3. Deploy via Dokploy
- Create PostgreSQL service (18.x)
- Create Next.js service from GitHub repo `thiyo12/maintainex`
- Add env vars from `envs/production.env`
- Add volume: `/app/public/uploads` for uploads persistence

### 4. Restore database (from Dokploy PostgreSQL terminal or via SSH)
```bash
docker exec -i $(docker ps | grep maintainex-db | awk '{print $1}') psql -U postgres -d postgres < maintainex-db-dump.sql
```

### 5. Update env vars for new server
```bash
# If server IP changes, update DATABASE_URL and NEXTAUTH_URL
docker service update maintainex-app --env-add DATABASE_URL=postgresql://postgres:NEW_PASS@NEW_DB_HOST:5432/postgres
```
