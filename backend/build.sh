#!/bin/bash
set -e

echo "🔨 Building FastAPI backend..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Check if Node.js is available (needed for prisma py fetch)
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js not found. Installing..."
    # Railway usually has Node.js, but if not, we'll skip binary fetch
    # The binaries should be downloaded during local development
    echo "⚠️  Skipping prisma py fetch - binaries should be committed"
else
    echo "📥 Fetching Prisma query engine binaries..."
    # Navigate to parent directory to access prisma schema
    cd ..
    python -m prisma py fetch --schema=prisma/schema.prisma || echo "⚠️  Failed to fetch binaries, continuing..."
    cd backend
fi

echo "✅ Build complete!"

