# FastAPI Backend for Asset Management System

FastAPI backend service for improved performance in production environments.

## Setup

1. **Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Run the FastAPI server:**
```bash
# Recommended: Use run.py (handles Windows event loop fix)
python run.py

# Or with uvicorn directly (Windows users should use run.py instead):
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints

- `GET /api/locations` - Get all locations (with optional `?search=term`)
- `POST /api/locations` - Create new location
- `PUT /api/locations/{id}` - Update location
- `DELETE /api/locations/{id}` - Delete location
- `GET /health` - Health check

## Next.js Integration

Update your `.env.local` to enable FastAPI:

```env
NEXT_PUBLIC_USE_FASTAPI=true
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

Then update `hooks/use-locations.ts` to use FastAPI when enabled.

