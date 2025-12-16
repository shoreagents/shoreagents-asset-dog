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

# Now import and run uvicorn
import uvicorn
from main import app

if __name__ == "__main__":
    # Read PORT from environment (Railway/Render/Fly.io set this)
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        loop="asyncio"
    )

