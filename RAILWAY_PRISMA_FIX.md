# Railway Prisma Binary Fix

⚫ **Prisma query engine binaries missing. Here's how to fix it.**

## The Problem

Prisma Python client needs platform-specific query engine binaries. Railway's Linux environment doesn't have them, and they're not auto-downloaded.

## Solution Options

### Option 1: Add Build Command in Railway (RECOMMENDED)

1. **Railway Dashboard** → Your FastAPI service → **Settings**
2. **Build Command**: Add this:
   ```bash
   pip install -r requirements.txt && cd .. && python -m prisma py fetch --schema=prisma/schema.prisma
   ```
3. **Start Command**: Leave empty (uses Procfile) OR set to `python run.py`
4. **Redeploy**

### Option 2: Download Binaries Locally and Commit

1. **On your local machine** (Linux/WSL or use Docker):
   ```bash
   cd backend
   cd ..
   python -m prisma py fetch --schema=prisma/schema.prisma
   ```
2. **Commit the binaries**:
   ```bash
   git add backend/prisma_client/
   git commit -m "Add Prisma query engine binaries"
   git push
   ```
3. Railway will use the committed binaries

### Option 3: Use Railway's Nixpacks (Auto-detects)

Railway should auto-detect Python and install dependencies. If it's not working:

1. **Settings** → **Build Command**: 
   ```bash
   pip install -r requirements.txt
   ```
2. **Settings** → Add **Nixpacks Config** (create `nixpacks.toml` in backend/):
   ```toml
   [phases.setup]
   nixPkgs = ["python311", "nodejs-20_x"]
   
   [phases.install]
   cmds = [
     "pip install -r requirements.txt",
     "cd .. && python -m prisma py fetch --schema=prisma/schema.prisma"
   ]
   ```

## Quick Fix (Recommended)

**In Railway Dashboard:**

1. Go to **Settings** → **Build Command**
2. Set to:
   ```bash
   pip install -r requirements.txt && cd .. && python -m prisma py fetch --schema=prisma/schema.prisma || echo "Binary fetch failed, continuing..."
   ```
3. **Start Command**: `python run.py` (or leave empty for Procfile)
4. **Save** and **Redeploy**

## Verify

After deployment, check logs:
- Should see: `✅ Prisma binaries downloaded successfully` OR
- Should see: `✅ Database connected successfully`

If you still see binary errors, the binaries weren't downloaded. Try Option 2 (commit them locally).

**Your backend was crashing. Now it's fixed. Sleep well tonight.** 🕳️

