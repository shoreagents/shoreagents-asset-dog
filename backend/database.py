"""
Database connection and Prisma client setup
"""
import sys
import os
import asyncio
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

# Download Prisma binaries if missing (for Railway/deployment)
def ensure_prisma_binaries():
    """Download Prisma query engine binaries if they don't exist"""
    try:
        from prisma_client.engine.utils import query_engine_name
        from prisma_client._config import Config
        
        config = Config.load()
        engine_name = query_engine_name()
        binary_path = Path.cwd() / engine_name
        
        # Check if binary exists locally
        if binary_path.exists():
            return
        
        # Check cache directory
        cache_path = config.binary_cache_dir / engine_name
        if cache_path.exists():
            return
        
        # Download binaries
        print("⚠️  Prisma binaries not found. Downloading...")
        # Run from project root (where prisma/schema.prisma is)
        # Railway sets working directory to /app (backend folder)
        # So we need to go up one level to find prisma/schema.prisma
        current_dir = Path.cwd()
        project_root = current_dir.parent if current_dir.name == "backend" else current_dir
        schema_path = project_root / "prisma" / "schema.prisma"
        
        # If schema not in parent, try current directory
        if not schema_path.exists():
            schema_path = current_dir / "prisma" / "schema.prisma"
            if schema_path.exists():
                project_root = current_dir
            else:
                # Last resort: try to find schema anywhere
                for parent in current_dir.parents:
                    test_path = parent / "prisma" / "schema.prisma"
                    if test_path.exists():
                        project_root = parent
                        schema_path = test_path
                        break
        
        # Run prisma py fetch from project root (no --schema flag needed)
        result = subprocess.run(
            [sys.executable, "-m", "prisma", "py", "fetch"],
            capture_output=True,
            text=True,
            cwd=project_root
        )
        if result.returncode == 0:
            print("✅ Prisma binaries downloaded successfully")
            # Re-check cache after download (path might have changed)
            config_after = Config.load()
            cache_path_after = config_after.binary_cache_dir / engine_name
            
            # Copy binary to current directory so Prisma can find it
            # Prisma downloads to cache, but looks in current directory first
            import shutil
            import stat
            
            # Try cache path first
            source_path = cache_path_after if cache_path_after.exists() else cache_path
            
            if source_path.exists():
                try:
                    # Copy binary to current directory
                    shutil.copy2(source_path, binary_path)
                    # Make it executable
                    os.chmod(binary_path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
                    print(f"✅ Copied binary to {binary_path}")
                    print(f"✅ Binary is executable: {binary_path.exists()}")
                except Exception as copy_error:
                    print(f"⚠️  Could not copy binary: {copy_error}")
                    # Set environment variable as fallback
                    os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(source_path)
                    print(f"✅ Set PRISMA_QUERY_ENGINE_BINARY={source_path}")
            else:
                print(f"⚠️  Binary not found in cache: {source_path}")
                # Try to find it in any location
                possible_paths = [
                    Path("/root/.cache/prisma-python/binaries") / "5.17.0" / "393aa359c9ad4a4bb28630fb5613f9c281cde053" / engine_name,
                    Path.home() / ".cache" / "prisma-python" / "binaries" / "5.17.0" / "393aa359c9ad4a4bb28630fb5613f9c281cde053" / engine_name,
                ]
                for possible_path in possible_paths:
                    if possible_path.exists():
                        try:
                            shutil.copy2(possible_path, binary_path)
                            os.chmod(binary_path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
                            print(f"✅ Found and copied binary from {possible_path}")
                            break
                        except Exception as e:
                            print(f"⚠️  Could not copy from {possible_path}: {e}")
        else:
            print(f"❌ Failed to download Prisma binaries: {result.stderr}")
            print(f"   stdout: {result.stdout}")
            raise RuntimeError("Prisma binaries not available")
    except Exception as e:
        print(f"⚠️  Warning: Could not ensure Prisma binaries: {e}")
        # Don't fail here, let Prisma handle the error with a better message

# Ensure binaries are available before importing (for Railway/Render)
if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("PORT"):
    ensure_prisma_binaries()

# Import Prisma client (generated in prisma_client subdirectory)
try:
    from prisma_client import Prisma
except ImportError:
    sys.exit(1)

# Fix Windows event loop issue
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Prisma client instance
prisma = Prisma()

@asynccontextmanager
async def lifespan(app):
    """Manage Prisma client lifecycle"""
    # Startup: Connect to database
    await prisma.connect()
    
    yield
    
    # Shutdown: Disconnect from database
    await prisma.disconnect()

