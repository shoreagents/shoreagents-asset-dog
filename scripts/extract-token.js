#!/usr/bin/env node
/**
 * Extract Supabase access token from base64-encoded cookie value
 * 
 * Usage:
 *   node scripts/extract-token.js "base64-eyJhY2Nlc3NfdG9rZW4iOi..."
 * 
 * Or paste the cookie value when prompted
 */

const readline = require('readline');

function extractToken(cookieValue) {
    try {
        let base64Data = cookieValue.trim();
        
        // Remove "base64-" prefix if present
        if (base64Data.startsWith('base64-')) {
            base64Data = base64Data.substring(7);
        }
        
        // URL decode if needed
        try {
            base64Data = decodeURIComponent(base64Data);
        } catch (e) {
            // Not URL encoded, continue
        }
        
        // Handle base64url encoding (URL-safe base64 uses - and _ instead of + and /)
        base64Data = base64Data.replace(/-/g, '+').replace(/_/g, '/');
        
        // Add padding if needed
        while (base64Data.length % 4) {
            base64Data += '=';
        }
        
        // Decode base64
        const decodedBytes = Buffer.from(base64Data, 'base64');
        const decodedStr = decodedBytes.toString('utf-8');
        const cookieData = JSON.parse(decodedStr);
        
        // Extract access token
        const accessToken = cookieData.access_token || 
                           (cookieData.session && cookieData.session.access_token);
        
        if (accessToken) {
            console.log('\n✅ Token Found!\n');
            console.log('Access Token:');
            console.log(accessToken);
            console.log('\n' + '='.repeat(80));
            
            if (cookieData.expires_at) {
                const expiresAt = new Date(cookieData.expires_at * 1000);
                console.log(`Token expires at: ${expiresAt.toLocaleString()}`);
            }
            
            if (cookieData.user_id) {
                console.log(`User ID: ${cookieData.user_id}`);
            }
            
            if (cookieData.email) {
                console.log(`Email: ${cookieData.email}`);
            }
            
            console.log('='.repeat(80));
            console.log('\n💡 Copy the Access Token above and use it in Postman as Bearer Token\n');
            
            return accessToken;
        } else {
            console.error('❌ No access_token found in cookie data');
            console.log('\nCookie data structure:');
            console.log(JSON.stringify(cookieData, null, 2));
            return null;
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        console.error('\nStack trace:');
        console.error(error.stack);
        return null;
    }
}

// Browser version (for console)
if (typeof window !== 'undefined') {
    // Running in browser
    window.extractSupabaseToken = function(cookieValue) {
        try {
            let base64Data = cookieValue.trim();
            
            if (base64Data.startsWith('base64-')) {
                base64Data = base64Data.substring(7);
            }
            
            try {
                base64Data = decodeURIComponent(base64Data);
            } catch (e) {
                // Not URL encoded
            }
            
            base64Data = base64Data.replace(/-/g, '+').replace(/_/g, '/');
            while (base64Data.length % 4) {
                base64Data += '=';
            }
            
            const decodedStr = atob(base64Data);
            const cookieData = JSON.parse(decodedStr);
            const accessToken = cookieData.access_token || 
                               (cookieData.session && cookieData.session.access_token);
            
            if (accessToken) {
                console.log('✅ Token Found!');
                console.log('Access Token:', accessToken);
                
                // Copy to clipboard
                navigator.clipboard.writeText(accessToken).then(() => {
                    console.log('✅ Token copied to clipboard!');
                });
                
                return accessToken;
            } else {
                console.error('❌ No access_token found');
                return null;
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            return null;
        }
    };
    
    console.log('Browser version loaded. Use: extractSupabaseToken("base64-...")');
}

// Node.js version (command line)
if (typeof require !== 'undefined' && require.main === module) {
    const cookieValue = process.argv[2];
    
    if (cookieValue) {
        extractToken(cookieValue);
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('Paste your cookie value (starting with "base64-") and press Enter:');
        rl.on('line', (input) => {
            if (input.trim()) {
                extractToken(input);
                rl.close();
            }
        });
    }
}

module.exports = { extractToken };

