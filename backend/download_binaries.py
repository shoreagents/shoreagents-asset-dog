#!/usr/bin/env python3
"""
Download Prisma query engine binaries if missing
Run this before starting the FastAPI server
"""
import subprocess
import sys
import os

def download_binaries():
    """Download Prisma query engine binaries"""
    try:
        print("📥 Downloading Prisma query engine binaries...")
        
        # Navigate to parent directory to access prisma schema
        script_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(script_dir)
        schema_path = os.path.join(parent_dir, "prisma", "schema.prisma")
        
        # Run prisma py fetch
        result = subprocess.run(
            ["python", "-m", "prisma", "py", "fetch", "--schema", schema_path],
            cwd=parent_dir,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Prisma binaries downloaded successfully")
            return True
        else:
            print(f"⚠️  Failed to download binaries: {result.stderr}")
            return False
    except Exception as e:
        print(f"⚠️  Error downloading binaries: {e}")
        return False

if __name__ == "__main__":
    success = download_binaries()
    sys.exit(0 if success else 1)

