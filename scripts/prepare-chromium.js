/* eslint-disable @typescript-eslint/no-require-imports */
// Chromium preparation script for Vercel
// @sparticuz/chromium will handle downloading Chromium at runtime
// This script just verifies the package is available

if (process.env.VERCEL || process.env.CI) {
  console.log('Verifying Chromium package for Vercel deployment...');
  
  try {
    // Verify chromium package is available
    const chromium = require('@sparticuz/chromium');
    
    if (chromium && typeof chromium.executablePath === 'function') {
      console.log('✓ Chromium package verified for Vercel deployment');
    } else {
      console.warn('⚠ Chromium package found but executablePath function not available');
    }
  } catch (error) {
    console.warn('⚠ Warning: Could not verify Chromium package:', error.message);
    console.warn('Chromium will be downloaded at runtime on Vercel.');
  }
} else {
  console.log('Skipping Chromium verification (local development)');
}

