#!/bin/bash
# Build script for Railway/Render deployment
# Generates Prisma Python client with Linux binaries

set -e

echo "Building FastAPI backend..."

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Generate Prisma Python client
echo "Generating Prisma Python client..."
# Navigate to root to access prisma/schema.prisma
cd ..
python -m prisma generate --schema=prisma/schema.prisma --generator=python_client

# Fetch Prisma query engine binaries for Linux
echo "Fetching Prisma query engine binaries..."
python -m prisma py fetch

# Return to backend directory
cd backend

echo "✅ Build complete!"

