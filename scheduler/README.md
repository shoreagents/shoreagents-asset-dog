# Asset Dog Scheduler Service

A lightweight scheduler service that triggers automated report generation every 5 minutes.

## Setup

### Railway Deployment

1. Create a new service in Railway
2. Connect this folder (`scheduler/`) as the root directory
3. Add the following environment variables:
   - `FASTAPI_BASE_URL`: Your backend URL (e.g., `https://asset-dog-backend.up.railway.app`)
   - `CRON_SECRET`: The same secret used in your backend

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FASTAPI_BASE_URL` | Yes | The full URL to your FastAPI backend |
| `CRON_SECRET` | Yes | Secret key for authenticating cron requests |

## How It Works

1. On startup, the scheduler immediately calls the cron endpoint
2. Then it runs every 5 minutes (configurable in `index.js`)
3. The cron endpoint checks for scheduled reports that are due and sends them

## Local Testing

```bash
cd scheduler
npm install
FASTAPI_BASE_URL=http://localhost:8000 CRON_SECRET=your-secret npm start
```

## Logs

The scheduler logs all activities:
- `✅ Success` - Report processing completed
- `❌ Failed` - HTTP error from the backend
- `❌ Error` - Network or connection error

