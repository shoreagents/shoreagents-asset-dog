FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Node.js (required for Prisma CLI)
RUN apt-get update && apt-get install -y \
    gcc \
    openssl \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (including prisma_client which has schema.prisma)
COPY . .

# Regenerate Prisma Python client to get Linux binary paths
# The client was generated on Windows, so BINARY_PATHS has Windows paths
# We need to regenerate it on Linux to get the correct binary paths and download Linux binaries
# Fix: The schema has output="../backend/prisma_client" but we're already in /app (backend)
# So we need to create a temporary schema with correct output path
RUN cd /app && \
    python -c "from prisma_client.cli.prisma import ensure_cached; ensure_cached()" && \
    python -c "import sys; import os; from pathlib import Path; from prisma_client.cli.prisma import run; \
    schema_path = None; \
    for path in ['prisma_client/schema.prisma', 'prisma/schema.prisma']: \
        if os.path.exists(path): schema_path = path; break; \
    if not schema_path: \
        print('ERROR: Could not find schema.prisma'); \
        sys.exit(1); \
    print(f'Found schema at: {schema_path}'); \
    # Read schema and fix output path \
    schema_content = Path(schema_path).read_text(); \
    # Replace output path to be relative to current directory \
    import re; \
    schema_content = re.sub(r'output\s*=\s*[\"\\']\.\./backend/prisma_client[\"\\']', 'output = \"prisma_client\"', schema_content); \
    # Write temporary schema \
    temp_schema = Path('schema.temp.prisma'); \
    temp_schema.write_text(schema_content); \
    print(f'Created temporary schema with corrected output path'); \
    args = ['generate', '--generator=python_client', f'--schema={temp_schema}']; \
    print(f'Running: prisma {\" \".join(args)}'); \
    result = run(args); \
    temp_schema.unlink(); \
    print(f'Generate completed with exit code: {result}'); \
    if result != 0: \
        print('ERROR: prisma generate failed'); \
        sys.exit(result); \
    # Verify regeneration worked \
    client_file = Path('prisma_client/client.py'); \
    if client_file.exists(): \
        content = client_file.read_text(); \
        if 'debian-openssl' in content or ('linux' in content.lower() and 'windows' not in content.lower()): \
            print('SUCCESS: Client regenerated with Linux binary paths'); \
        else: \
            print('WARNING: Checking BINARY_PATHS content...'); \
            import re; \
            match = re.search(r'BINARY_PATHS = model_parse\(BinaryPaths, ({.*?})\)', content, re.DOTALL); \
            if match: print(f'BINARY_PATHS: {match.group(1)[:200]}...'); \
    sys.exit(0)"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

