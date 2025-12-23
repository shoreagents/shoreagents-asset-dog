FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Node.js (required for Prisma CLI)
RUN apt-get update && apt-get install -y \
    gcc \
    openssl \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers and their system dependencies
# Note: install-deps runs apt-get internally, so we keep apt lists available
RUN playwright install chromium \
    && playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy application code (including prisma_client which has schema.prisma)
COPY . .

# Regenerate Prisma Python client to get Linux binary paths
# The client was generated on Windows, so BINARY_PATHS has Windows paths
# We need to regenerate it on Linux to get the correct binary paths and download Linux binaries
# Fix: The schema has output="../backend/prisma_client" but we're already in /app (backend)
# So we need to create a temporary schema with correct output path
RUN python regenerate_prisma.py

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

