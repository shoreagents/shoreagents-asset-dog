"""
Authentication utilities for FastAPI
"""
from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer
import os
import json
import base64
from urllib.parse import unquote
import httpx
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

security = HTTPBearer(auto_error=False)

async def verify_auth(request: Request) -> dict:
    """
    Verify user authentication using Supabase session from cookies or Authorization header.
    Returns the user data if authenticated, raises HTTPException if not.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        missing = []
        if not SUPABASE_URL:
            missing.append("NEXT_PUBLIC_SUPABASE_URL")
        if not SUPABASE_ANON_KEY:
            missing.append("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        raise HTTPException(
            status_code=500,
            detail=f"Authentication service not configured. Missing environment variables: {', '.join(missing)}"
        )
    
    access_token = None
    
    # Try to get token from Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        access_token = auth_header.split("Bearer ")[1]
    else:
        # Try to get token from cookies
        # Supabase stores session in cookies with pattern: sb-<project-ref>-auth-token
        cookies = request.cookies
        auth_token_cookie = None
        
        # Find the Supabase auth token cookie
        for cookie_name in cookies.keys():
            cookie_lower = cookie_name.lower()
            if 'sb-' in cookie_lower and 'auth-token' in cookie_lower:
                auth_token_cookie = cookies.get(cookie_name)
                break
        
        if auth_token_cookie:
            # Parse the cookie value (Supabase SSR stores it in various formats)
            access_token = _extract_token_from_cookie(auth_token_cookie)
    
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )
    
    try:
        # Verify the token using Supabase REST API
        async with httpx.AsyncClient() as client:
            verify_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": SUPABASE_ANON_KEY
                },
                timeout=10.0
            )
            
            if verify_response.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="Unauthorized"
                )
            
            response_data = verify_response.json()
            
            # Handle different response structures
            # Supabase might return {"user": {...}} or directly {...}
            if isinstance(response_data, dict) and "user" in response_data:
                user_data = response_data["user"]
            else:
                user_data = response_data
            
            # Validate user data
            if not user_data or not isinstance(user_data, dict):
                raise HTTPException(
                    status_code=401,
                    detail="Unauthorized"
                )
            
            user_id = user_data.get("id")
            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="Unauthorized"
                )
            
            return {
                "user": user_data,
                "user_id": user_id,
                "email": user_data.get("email"),
                "user_metadata": user_data.get("user_metadata", {})
            }
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=503,
            detail="Service unavailable"
        )
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )


def _extract_token_from_cookie(auth_token_cookie: str) -> str | None:
    """Extract access token from Supabase cookie"""
    access_token = None
    
    # Strategy 1: Handle base64- prefixed cookies (common in Supabase SSR)
    cookie_to_parse = auth_token_cookie
    
    # First, try URL decoding (cookies are often URL-encoded)
    if '%' in cookie_to_parse:
        try:
            cookie_to_parse = unquote(cookie_to_parse)
        except:
            pass
    
    if cookie_to_parse.startswith('base64-'):
        try:
            # Remove the "base64-" prefix
            base64_data = cookie_to_parse[7:]
            
            # URL decode the base64 string itself (it might be URL-encoded)
            try:
                base64_data = unquote(base64_data)
            except:
                pass
            
            # Handle base64url encoding (URL-safe base64 uses - and _ instead of + and /)
            base64_data = base64_data.replace('-', '+').replace('_', '/')
            
            # Add padding if needed
            missing_padding = len(base64_data) % 4
            if missing_padding:
                base64_data += '=' * (4 - missing_padding)
            
            # Try decoding
            try:
                decoded_bytes = base64.b64decode(base64_data, validate=True)
            except Exception:
                decoded_bytes = base64.b64decode(base64_data, validate=False)
            
            decoded_str = decoded_bytes.decode('utf-8')
            cookie_data = json.loads(decoded_str)
            
            if isinstance(cookie_data, dict):
                access_token = cookie_data.get('access_token')
                if not access_token and 'session' in cookie_data:
                    access_token = cookie_data['session'].get('access_token')
        except Exception:
            pass
    
    # Strategy 2: URL decode then JSON parse
    if not access_token:
        try:
            decoded = unquote(auth_token_cookie)
            cookie_data = json.loads(decoded)
            if isinstance(cookie_data, dict):
                access_token = cookie_data.get('access_token')
                if not access_token:
                    if 'session' in cookie_data and isinstance(cookie_data['session'], dict):
                        access_token = cookie_data['session'].get('access_token')
        except (json.JSONDecodeError, TypeError, AttributeError, UnicodeDecodeError):
            pass
    
    # Strategy 3: Direct JSON parse
    if not access_token:
        try:
            cookie_data = json.loads(auth_token_cookie)
            if isinstance(cookie_data, dict):
                access_token = cookie_data.get('access_token')
                if not access_token and 'session' in cookie_data:
                    access_token = cookie_data['session'].get('access_token')
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass
    
    # Strategy 4: Check if cookie value itself is a valid JWT
    if not access_token:
        parts = auth_token_cookie.split('.')
        if len(parts) == 3:
            access_token = auth_token_cookie
    
    return access_token

