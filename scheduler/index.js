/**
 * Asset Dog Scheduler Service
 * 
 * Runs every 5 minutes to trigger the automated reports cron endpoint.
 * Deploy this as a separate Railway service.
 * 
 * Required Environment Variables:
 * - FASTAPI_BASE_URL: The backend API URL (e.g., https://asset-dog-backend.up.railway.app)
 * - CRON_SECRET: Secret key for authenticating cron requests
 */

const fetch = require('node-fetch');

// Configuration
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

// Validate environment variables
if (!FASTAPI_BASE_URL) {
  console.error('❌ ERROR: FASTAPI_BASE_URL environment variable is not set');
  process.exit(1);
}

if (!CRON_SECRET) {
  console.error('❌ ERROR: CRON_SECRET environment variable is not set');
  process.exit(1);
}

const CRON_ENDPOINT = `${FASTAPI_BASE_URL}/api/cron/send-scheduled-reports`;

console.log('🚀 Asset Dog Scheduler Started');
console.log(`📍 Target endpoint: ${CRON_ENDPOINT}`);
console.log(`⏰ Interval: ${INTERVAL_MS / 1000 / 60} minutes`);
console.log('-------------------------------------------');

/**
 * Call the cron endpoint to process scheduled reports
 */
async function triggerScheduledReports() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔄 Triggering scheduled reports...`);

  try {
    const response = await fetch(CRON_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for report generation
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${timestamp}] ✅ Success:`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[${timestamp}] ❌ Failed (${response.status}):`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error:`, error.message);
  }
}

// Run immediately on startup
triggerScheduledReports();

// Then run every 5 minutes
setInterval(triggerScheduledReports, INTERVAL_MS);

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

console.log('✅ Scheduler is running. Press Ctrl+C to stop.');

