# Dokploy Persistent Storage Setup Guide

## Problem
Uploaded images don't persist because Docker containers have ephemeral storage. When the container restarts or rebuilds, all uploaded files are lost.

## Solution
Configure a persistent volume in Dokploy to store uploaded files on the host machine.

---

## Step-by-Step Instructions

### Step 1: Access Dokploy Dashboard
1. Open your Dokploy panel (usually `https://dokploy.your-domain.com` or provided by Hostinger)
2. Login with your credentials

### Step 2: Navigate to Your Project
1. Find your **Maintain** project in the dashboard
2. Click on the project to open it

### Step 3: Find Persistent Volumes Section
1. Look for these sections (might be named differently depending on Dokploy version):
   - **Settings** → **Volumes**
   - **Storage** → **Persistent Volumes**
   - **Docker** → **Volumes**
   - Or look for a **" volumes"** tab/icon

### Step 4: Add Persistent Volumes (TWO required)

There are **two** upload locations in the app (recent production build). A single `uploads` volume for `public/uploads` is NOT enough — the mobile job photos live at `uploads/mobile/` and must be a separate volume, otherwise user photos are wiped on every redeploy.

Click **"Add Volume"** / **"Create Volume"** for each:

| Field | Value (Volume 1 — static/avatar images) | Value (Volume 2 — mobile job photos) |
|-------|-------------------------------|------------------------------|
| **Volume Name** | `uploads` | `uploads-mobile` |
| **Host Path** | `/root/dokploy/volumes/uploads` | `/root/dokploy/volumes/uploads-mobile` |
| **Container Path** | `/app/public/uploads` | `/app/uploads/mobile` |
| **Type** | `Bind Mount` | `Bind Mount` |

> **Why `uploads/mobile`:** the mobile upload endpoint (`app/api/mobile/upload/route.ts`) writes files to `<cwd>/uploads/mobile/<userId>/` and serves them via `/api/mobile/files/...`. This lives OUTSIDE `public/` and only inside the container's writable layer, so without this second volume every redeploy loses all job/avatar photos. The DB still holds the old URL strings, which would then return 404.

### Step 5: Create Host Directories (SSH Required)

Connect to your VPS via SSH and create the directories:

```bash
# Connect to VPS
ssh root@your-vps-ip

# Create the uploads directories (both)
mkdir -p /root/dokploy/volumes/uploads
mkdir -p /root/dokploy/volumes/uploads-mobile

# Set permissions
chmod -R 755 /root/dokploy/volumes/uploads
chmod -R 755 /root/dokploy/volumes/uploads-mobile

# Verify
ls -la /root/dokploy/volumes/
```

### Step 5b: BACK UP existing data BEFORE the first slim redeploy

If you are redeploying on top of a running container that already has uploaded files (and no volume was mounted before), back them up FIRST or the slim rebuild wipes them:

```bash
# Find the running container
docker ps --filter name=maintainex --format "{{.Names}}"

# Copy current uploads out of the container (adjust container name)
docker cp <container-name>:/app/uploads/mobile /root/dokploy/backups/uploads-mobile
docker cp <container-name>:/app/public/uploads /root/dokploy/backups/public-uploads

# After mounting the volumes, restore any data that was already sitting in the container
cp -an /root/dokploy/backups/uploads-mobile/. /root/dokploy/volumes/uploads-mobile/
cp -an /root/dokploy/backups/public-uploads/. /root/dokploy/volumes/uploads/
```

### Step 6: Redeploy the Container

After saving the volume configuration:
1. Go to your project's **Deployments** tab
2. Click **"Redeploy"** or **"Restart"**
3. Wait for the container to restart

---

## Alternative: If Dokploy UI Doesn't Have Volume Settings

### Option A: Use Docker Compose Override
Create a file called `docker-compose.override.yml` in your project:

```yaml
version: '3.8'
services:
  app:
    volumes:
      - /root/dokploy/volumes/uploads:/app/public/uploads
      - /root/dokploy/volumes/uploads-mobile:/app/uploads/mobile
```

### Option B: Edit Dokploy's Docker Compose
1. In Dokploy, find **"Docker Compose"** or **"Advanced Settings"**
2. Add under your service:

```yaml
volumes:
  - /root/dokploy/volumes/uploads:/app/public/uploads
  - /root/dokploy/volumes/uploads-mobile:/app/uploads/mobile
```

### Option C: Hostinger Cloud Panel
1. Login to Hostinger VPS hPanel
2. Go to **Docker Management** or **Container Management**
3. Find your maintainex container
4. Look for **Volumes** or **Mounts** settings
5. Add a bind mount:
   - Host: `/root/dokploy/volumes/uploads`
   - Container: `/app/public/uploads`

---

## Verification

After setup:
1. Go to Admin → Services
2. Edit any service
3. Upload a new image
4. Click Save
5. The image URL in the database should be like `/uploads/services/filename.jpg`
6. Check if the file exists: `ls -la /root/dokploy/volumes/uploads/`
7. Try restarting the container and verify the image still loads

---

## Troubleshooting

### "Volume already exists" error
```bash
# Remove existing volume
docker volume rm your-project-uploads

# Or create with different name
```

### "Permission denied" error
```bash
# On VPS, fix permissions
chmod -R 755 /root/dokploy/volumes/uploads
chown -R 1000:1000 /root/dokploy/volumes/uploads
```

### Images still not persisting
1. Check if volume is correctly mounted:
   ```bash
   docker exec -it your-container-name ls -la /app/public/uploads/
   ```
2. Check Docker logs for mount errors

---

## Quick SSH Commands Reference

```bash
# Connect to VPS
ssh root@YOUR_VPS_IP

# Create directories (if not already)
mkdir -p /root/dokploy/volumes/uploads
mkdir -p /root/dokploy/volumes/uploads-mobile

# Set permissions
chmod -R 755 /root/dokploy/volumes/uploads
chmod -R 755 /root/dokploy/volumes/uploads-mobile

# List Docker containers
docker ps

# Check container volumes
docker inspect container-name | grep -A 20 Mounts

# Verify both mounts are populated
ls -la /root/dokploy/volumes/uploads/
ls -la /root/dokploy/volumes/uploads-mobile/

# Restart container
docker restart container-name
```

---

## Need Help?

If you're stuck at any step, share screenshots of:
1. Your Dokploy project page
2. The Volumes/Storage section
3. Any error messages you see

I'll help you configure it correctly.
