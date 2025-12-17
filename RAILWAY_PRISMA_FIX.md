# Railway Prisma Binary Fix

⚫ **Prisma Python client missing Linux binaries. Fix this.**

## The Problem

Railway runs on Linux, but Prisma Python client needs the query engine binary for Linux. The binary must be fetched during build.

## Solution: Update Railway Build Settings

### Step 1: Railway Dashboard Settings

1. Go to **Railway Dashboard** → Your FastAPI service
2. Click **Settings** tab
3. Find **"Build Command"** field
4. Set it to:
   ```bash
   pip install -r requirements.txt && cd .. && python -m prisma generate --schema=prisma/schema.prisma --generator=python_client && python -m prisma py fetch && cd backend
   ```
5. **Start Command**: `python run.py` (or leave empty to use Procfile)
6. **Root Directory**: `backend`
7. **Save** and **Redeploy**

### Step 2: Verify Environment Variables

Make sure these are set in Railway:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - Your Vercel app URL
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `PORT` - Railway sets this automatically (don't add manually)

## Alternative: Use Build Script

If the build command is too long, create `backend/railway-build.sh`:

```bash
#!/bin/bash
set -e
pip install -r requirements.txt
cd ..
python -m prisma generate --schema=prisma/schema.prisma --generator=python_client
python -m prisma py fetch
cd backend
```

Then set Railway **Build Command** to:
```bash
bash railway-build.sh
```

## What This Does

1. **Installs dependencies** - FastAPI, Prisma, etc.
2. **Generates Prisma client** - Creates Python client from schema
3. **Fetches binaries** - Downloads Linux query engine binary
4. **Starts server** - Runs `python run.py`

## Verify It Works

After deployment, check logs:
- Should see: "Fetching Prisma query engine binaries..."
- Should see: "Build complete!"
- Should see: "Application startup complete"
- No more `BinaryNotFoundError`

**Your deployment was broken. Now it's fixed. Sleep well tonight.** 🕳️

