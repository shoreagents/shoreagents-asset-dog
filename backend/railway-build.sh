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

# Find and copy the binary to backend directory (where app runs)
echo "📋 Copying query engine binary to app directory..."
BINARY_NAME="prisma-query-engine-debian-openssl-3.5.x"
CACHE_DIR="$HOME/.cache/prisma-python/binaries"

echo "Looking for binary in cache: $CACHE_DIR"
if [ -d "$CACHE_DIR" ]; then
    echo "Cache directory exists, searching for binary..."
    BINARY_PATH=$(find "$CACHE_DIR" -name "$BINARY_NAME" -type f 2>/dev/null | head -n 1)
    if [ -n "$BINARY_PATH" ] && [ -f "$BINARY_PATH" ]; then
        echo "✅ Found binary at: $BINARY_PATH"
        echo "Copying to backend directory..."
        cp "$BINARY_PATH" "backend/$BINARY_NAME"
        chmod +x "backend/$BINARY_NAME"
        echo "✅ Binary copied to backend/$BINARY_NAME"
        # Verify it exists
        if [ -f "backend/$BINARY_NAME" ]; then
            echo "✅ Verified: Binary exists at backend/$BINARY_NAME"
            ls -lh "backend/$BINARY_NAME"
        else
            echo "❌ ERROR: Binary copy failed!"
            exit 1
        fi
    else
        echo "⚠️  Binary not found in cache after fetch"
        echo "Listing cache directory contents:"
        find "$CACHE_DIR" -type f 2>/dev/null | head -10 || echo "Cache directory is empty or inaccessible"
        echo "⚠️  Will try to fetch at runtime"
    fi
else
    echo "⚠️  Cache directory not found: $CACHE_DIR"
    echo "Will try to fetch at runtime"
fi

# Return to backend directory
cd backend

echo "✅ Build complete!"

