"""
Database connection and Prisma client setup
"""
import sys
import asyncio
from contextlib import asynccontextmanager

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

