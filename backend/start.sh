#!/bin/bash
# Startup script that ensures Prisma binary exists before starting the app
set -e

BINARY_NAME="prisma-query-engine-debian-openssl-3.5.x"
BINARY_PATH="/app/$BINARY_NAME"
CACHE_DIR="$HOME/.cache/prisma-python/binaries"

echo "🔍 Checking for Prisma query engine binary..."

# Check if binary exists in app directory
if [ ! -f "$BINARY_PATH" ]; then
    echo "⚠️  Binary not found in /app, checking cache..."
    
    # Try to find and copy from cache
    if [ -d "$CACHE_DIR" ]; then
        CACHED_BINARY=$(find "$CACHE_DIR" -name "$BINARY_NAME" -type f | head -n 1)
        if [ -n "$CACHED_BINARY" ] && [ -f "$CACHED_BINARY" ]; then
            echo "📋 Found binary in cache, copying to /app..."
            cp "$CACHED_BINARY" "$BINARY_PATH"
            chmod +x "$BINARY_PATH"
            echo "✅ Binary copied successfully"
        else
            echo "❌ Binary not found in cache, fetching..."
            cd /app
            python -m prisma py fetch
            # Try again after fetch
            CACHED_BINARY=$(find "$CACHE_DIR" -name "$BINARY_NAME" -type f | head -n 1)
            if [ -n "$CACHED_BINARY" ] && [ -f "$CACHED_BINARY" ]; then
                cp "$CACHED_BINARY" "$BINARY_PATH"
                chmod +x "$BINARY_PATH"
                echo "✅ Binary fetched and copied"
            else
                echo "❌ Failed to fetch binary"
                exit 1
            fi
        fi
    else
        echo "❌ Cache directory not found, fetching binary..."
        cd /app
        python -m prisma py fetch
        CACHED_BINARY=$(find "$HOME/.cache" -name "$BINARY_NAME" -type f | head -n 1)
        if [ -n "$CACHED_BINARY" ] && [ -f "$CACHED_BINARY" ]; then
            cp "$CACHED_BINARY" "$BINARY_PATH"
            chmod +x "$BINARY_PATH"
            echo "✅ Binary fetched and copied"
        else
            echo "❌ Failed to fetch binary"
            exit 1
        fi
    fi
else
    echo "✅ Binary found in /app"
fi

# Verify binary is executable
if [ ! -x "$BINARY_PATH" ]; then
    echo "⚠️  Binary not executable, fixing permissions..."
    chmod +x "$BINARY_PATH"
fi

echo "🚀 Starting FastAPI application..."
exec python run.py

