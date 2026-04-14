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

### Step 4: Add Persistent Volume

Click **"Add Volume"** or **"Create Volume"** and fill in:

| Field | Value |
|-------|-------|
| **Volume Name** | `uploads` |
| **Host Path** | `/root/dokploy/volumes/uploads` (create this folder on VPS first) |
| **Container Path** | `/app/public/uploads` |
| **Type** | `Bind Mount` or `Volume` |

### Step 5: Create Host Directory (SSH Required)

Connect to your VPS via SSH and create the directory:

```bash
# Connect to VPS
ssh root@your-vps-ip

# Create the uploads directory
mkdir -p /root/dokploy/volumes/uploads

# Set permissions
chmod 755 /root/dokploy/volumes/uploads

# Verify
ls -la /root/dokploy/volumes/
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
```

### Option B: Edit Dokploy's Docker Compose
1. In Dokploy, find **"Docker Compose"** or **"Advanced Settings"**
2. Add under your service:

```yaml
volumes:
  - /root/dokploy/volumes/uploads:/app/public/uploads
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

# Create directory
mkdir -p /root/dokploy/volumes/uploads

# Set permissions
chmod 755 /root/dokploy/volumes/uploads

# List Docker containers
docker ps

# Check container volumes
docker inspect container-name | grep -A 20 Mounts

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
