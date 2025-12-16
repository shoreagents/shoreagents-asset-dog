"""
FastAPI startup script with Windows event loop fix
Use this instead of running uvicorn directly
Reads PORT from environment (for Railway/Render/Fly.io)
"""
import sys
import os
import asyncio

# Set event loop policy BEFORE importing anything that uses asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Read PORT from environment (Railway/Render/Fly.io set this)
port = int(os.getenv("PORT", "8000"))
print(f"🚀 Starting FastAPI server on port {port}")

# Check required environment variables
required_vars = ["DATABASE_URL"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    print(f"❌ ERROR: Missing required environment variables: {', '.join(missing_vars)}")
    sys.exit(1)

# Try to download Prisma binaries if missing (for Railway deployment)
try:
    from prisma_client import Prisma
    # Test if binaries exist by trying to create a client
    test_client = Prisma()
    del test_client
except Exception as e:
    # Binaries might be missing, try to download them
    print("⚠️  Prisma binaries not found, attempting to download...")
    try:
        import subprocess
        script_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(script_dir)
        schema_path = os.path.join(parent_dir, "prisma", "schema.prisma")
        
        result = subprocess.run(
            ["python", "-m", "prisma", "py", "fetch", "--schema", schema_path],
            cwd=parent_dir,
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            print("✅ Prisma binaries downloaded successfully")
        else:
            print(f"⚠️  Failed to download binaries: {result.stderr}")
            print("💡 Make sure Node.js is available for prisma py fetch")
    except Exception as download_error:
        print(f"⚠️  Could not download binaries: {download_error}")
        print("💡 Binaries should be committed to the repository")

# Now import and run uvicorn
try:
    import uvicorn
    from main import app
    
    print("✅ FastAPI app loaded successfully")
    print(f"📡 Server will be available at http://0.0.0.0:{port}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        loop="asyncio"
    )
except Exception as e:
    print(f"❌ Failed to start FastAPI server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

