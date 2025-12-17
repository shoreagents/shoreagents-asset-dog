#!/bin/bash
# Railway build script - generates Prisma client with Linux binaries
set -e

echo "🚀 Railway build started..."

# Install Python dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Generate Prisma Python client (from root directory to access schema)
echo "🔧 Generating Prisma Python client..."
cd ..
python -m prisma generate --schema=prisma/schema.prisma --generator=python_client

# Fetch Prisma query engine binaries for Linux (Debian)
echo "⬇️  Fetching Prisma query engine binaries..."
python -m prisma py fetch

# Return to backend directory
cd backend

echo "✅ Build complete!"

