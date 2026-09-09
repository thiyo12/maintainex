# MaintainEX Local PostgreSQL Development

## Prerequisites

- Docker installed and running
- Node.js 20+

## Quick Start

```bash
# Start PostgreSQL
docker compose up -d

# Verify health
docker compose exec postgres pg_isready -U maintainex

# Push schema (DEVELOPMENT ONLY)
npx prisma db push

# Generate client
npx prisma generate

# Start development
npm run dev
```

## Connection Details

| Property | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `maintainex` |
| User | `maintainex` |
| Password | `maintainex_dev_2025` |
| URL | `postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex` |

## Environment Configuration

The `.env` file should contain:

```
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex"
```

## Data Persistence

PostgreSQL data is stored in a Docker volume `postgres_data`. To reset:

```bash
docker compose down -v  # Deletes volume
docker compose up -d
npx prisma db push  # DEVELOPMENT ONLY
```

## Docker Compose File

Location: `/Users/thiyoth/Documents/NEWM/maintainex/docker-compose.yml`

Services:
- `postgres`: PostgreSQL 16 Alpine with health check

## Troubleshooting

### Connection refused
```bash
docker compose ps  # Check if running
docker compose logs postgres  # Check logs
```

### Authentication failed
```bash
docker compose exec postgres psql -U maintainex -d maintainex -c "SELECT 1"
```

### Port already in use
```bash
lsof -i :5432  # Find process using port
# Change port in docker-compose.yml if needed
```
