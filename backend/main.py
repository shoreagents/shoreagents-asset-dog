"""
FastAPI Backend for Asset Management System
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
from dotenv import load_dotenv

from database import lifespan
from routers import locations, sites, departments, company_info, categories, employees

# Load environment variables
load_dotenv()

# Configure logging - reduce verbosity
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors
    format='%(levelname)s:%(name)s:%(message)s'
)

# Reduce httpx logging verbosity
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Create FastAPI app
app = FastAPI(
    title="Asset Management API",
    description="FastAPI backend for asset management system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allow Next.js frontend
# Build allowed origins from environment variables
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

# Add production URL if provided
app_url = os.getenv("NEXT_PUBLIC_APP_URL")
if app_url:
    allowed_origins.append(app_url)

# Add Vercel preview URLs pattern (optional, for preview deployments)
# Uncomment if you want to allow all Vercel previews:
# vercel_url = os.getenv("VERCEL_URL")
# if vercel_url:
#     allowed_origins.append(f"https://{vercel_url}")

# Allow additional origins from environment (comma-separated)
additional_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
if additional_origins:
    allowed_origins.extend([origin.strip() for origin in additional_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(locations.router)
app.include_router(sites.router)
app.include_router(departments.router)
app.include_router(company_info.router)
app.include_router(categories.router)
app.include_router(employees.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "backend"}

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        loop="asyncio"
    )
