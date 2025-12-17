"""
Authentication API router
"""
from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import Dict, Any, Optional
import logging
import os
import httpx

from models.auth import (
    LoginRequest, LoginResponse,
    SignupRequest, SignupResponse,
    LogoutResponse,
    ChangePasswordRequest, ChangePasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
    UserUpdateRequest, UserResponse
)
from auth import verify_auth, SUPABASE_URL, SUPABASE_ANON_KEY
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Login user"""
    try:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        # Validate input
        if not login_data.email or not login_data.password:
            raise HTTPException(status_code=400, detail="Email and password are required")
        
        # Sign in with password using Supabase REST API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                json={
                    "email": login_data.email,
                    "password": login_data.password
                },
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                try:
                    error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = error_data.get("error_description") or error_data.get("error") or error_data.get("msg") or error_data.get("message") or "Invalid credentials"
                except Exception:
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                
                is_invalid_creds = (
                    "Invalid login credentials" in error_msg or
                    "Invalid credentials" in error_msg or
                    "Email not confirmed" in error_msg or
                    "Invalid login" in error_msg or
                    "Invalid email or password" in error_msg
                )
                
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password. Please check your credentials and try again." if is_invalid_creds else error_msg
                )
            
            try:
                auth_data = response.json()
            except Exception as json_error:
                logger.error(f"Error parsing Supabase JSON response: {str(json_error)}")
                raise HTTPException(status_code=500, detail="Invalid response from authentication service")
            
            user = auth_data.get("user", {})
            
            # Supabase REST API returns tokens directly, not in a session object
            # Construct session object from the response
            if not auth_data.get("session"):
                session = {
                    "access_token": auth_data.get("access_token"),
                    "refresh_token": auth_data.get("refresh_token"),
                    "expires_in": auth_data.get("expires_in"),
                    "expires_at": auth_data.get("expires_at"),
                    "token_type": auth_data.get("token_type", "bearer"),
                    "user": user
                }
            else:
                session = auth_data.get("session", {})
            
            if not user or not session or not session.get("access_token"):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            # Check if user account is active
            try:
                asset_user = await prisma.assetuser.find_unique(
                    where={"userId": user.get("id")}
                )
                
                if asset_user and not asset_user.isActive:
                    raise HTTPException(
                        status_code=403,
                        detail="Your account has been deactivated. Please contact your administrator."
                    )
            except HTTPException:
                raise
            except Exception as db_error:
                logger.error(f"Database error checking user status: {db_error}")
                # Don't block login if database query fails
            
            return LoginResponse(user=user, session=session)
    
    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.error(f"Request error calling Supabase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to authentication service: {str(e)}")
    except Exception as e:
        logger.error(f"Login error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(signup_data: SignupRequest):
    """Sign up new user"""
    try:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        # Validate email format
        import re
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, signup_data.email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate password length
        if len(signup_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
        # Create user in Supabase Auth using admin API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                json={
                    "email": signup_data.email,
                    "password": signup_data.password,
                    "email_confirm": True
                },
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_msg = error_data.get("message") or error_data.get("error") or "Failed to create account"
                
                if "already registered" in error_msg.lower() or "already exists" in error_msg.lower():
                    raise HTTPException(status_code=409, detail="An account with this email already exists")
                raise HTTPException(status_code=400, detail=error_msg)
            
            user_data = response.json()
            user_id = user_data.get("id")
            user_email = user_data.get("email")
            
            if not user_id:
                raise HTTPException(status_code=400, detail="Failed to create account")
            
            # Create asset_users record
            try:
                asset_user = await prisma.assetuser.create(
                    data={
                        "userId": user_id,
                        "role": "user",
                        "isActive": False,  # Pending admin approval
                        "isApproved": False,
                        "canDeleteAssets": False,
                        "canManageImport": False,
                        "canManageExport": True,
                        "canCreateAssets": False,
                        "canEditAssets": False,
                        "canViewAssets": False,
                        "canManageEmployees": False,
                        "canManageSetup": False,
                        "canCheckout": False,
                        "canCheckin": False,
                        "canReserve": False,
                        "canMove": False,
                        "canLease": False,
                        "canDispose": False,
                        "canManageMaintenance": False,
                        "canAudit": False,
                        "canManageMedia": False,
                        "canManageTrash": False,
                        "canManageUsers": False,
                        "canManageReturnForms": False,
                        "canViewReturnForms": False,
                        "canManageAccountabilityForms": False,
                        "canViewAccountabilityForms": False,
                        "canManageReports": False,
                        "canManageInventory": False,
                    }
                )
            except Exception as db_error:
                # If user already exists in database, that's okay
                if "P2002" in str(db_error) or "Unique constraint" in str(db_error):
                    raise HTTPException(status_code=409, detail="An account with this email already exists")
                logger.error(f"Database error creating user: {db_error}")
                raise HTTPException(status_code=500, detail="Failed to create account")
            
            return SignupResponse(
                message="Account created successfully. Please wait for admin approval.",
                user={
                    "id": str(asset_user.id),
                    "email": user_email
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create account")


@router.post("/logout", response_model=LogoutResponse)
async def logout(request: Request):
    """Logout user"""
    try:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        # Get access token from request
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            access_token = auth_header.split("Bearer ")[1]
            
            # Sign out using Supabase REST API
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/auth/v1/logout",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    timeout=10.0
                )
        
        return LogoutResponse(message="Logged out successfully")
    
    except Exception as e:
        logger.error(f"Logout error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/me", response_model=UserResponse)
async def get_current_user(auth: dict = Depends(verify_auth)):
    """Get current user information"""
    try:
        user_data = auth.get("user", {})
        user_id = auth.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Fetch user role and permissions from AssetUser table
        user_permissions = None
        try:
            asset_user = await prisma.assetuser.find_unique(
                where={"userId": user_id}
            )
            
            if asset_user:
                # Check if user account is inactive
                if not asset_user.isActive:
                    user_name = user_data.get("user_metadata", {}).get("name") or user_data.get("user_metadata", {}).get("full_name") or ""
                    raise HTTPException(
                        status_code=403,
                        detail="User account is inactive"
                    )
                
                # Build permissions dict
                user_permissions = {
                    "role": asset_user.role,
                    "isActive": asset_user.isActive,
                    "isApproved": asset_user.isApproved,
                    "canDeleteAssets": asset_user.canDeleteAssets,
                    "canManageImport": asset_user.canManageImport,
                    "canManageExport": asset_user.canManageExport,
                    "canCreateAssets": asset_user.canCreateAssets,
                    "canEditAssets": asset_user.canEditAssets,
                    "canViewAssets": asset_user.canViewAssets,
                    "canManageEmployees": asset_user.canManageEmployees,
                    "canManageSetup": asset_user.canManageSetup,
                    "canCheckout": asset_user.canCheckout,
                    "canCheckin": asset_user.canCheckin,
                    "canReserve": asset_user.canReserve,
                    "canMove": asset_user.canMove,
                    "canLease": asset_user.canLease,
                    "canDispose": asset_user.canDispose,
                    "canManageMaintenance": asset_user.canManageMaintenance,
                    "canAudit": asset_user.canAudit,
                    "canManageMedia": asset_user.canManageMedia,
                    "canManageTrash": asset_user.canManageTrash,
                    "canManageUsers": asset_user.canManageUsers,
                    "canManageReturnForms": asset_user.canManageReturnForms,
                    "canViewReturnForms": asset_user.canViewReturnForms,
                    "canManageAccountabilityForms": asset_user.canManageAccountabilityForms,
                    "canViewAccountabilityForms": asset_user.canViewAccountabilityForms,
                    "canManageReports": asset_user.canManageReports,
                    "canManageInventory": asset_user.canManageInventory,
                }
        except HTTPException:
            raise
        except Exception as db_error:
            logger.error(f"Error fetching user data: {db_error}")
            # User doesn't exist in AssetUser table - that's okay for new users
        
        # Extract name from user_metadata
        user_metadata = user_data.get("user_metadata", {})
        user_name = user_metadata.get("name") or user_metadata.get("full_name") or ""
        
        # Build user response
        user_response = {
            "id": user_id,
            "email": user_data.get("email"),
            "name": user_name,
            "avatar": user_metadata.get("avatar_url")
        }
        
        return UserResponse(
            user=user_response,
            role=user_permissions.get("role") if user_permissions else None,
            permissions=user_permissions,
            isActive=user_permissions.get("isActive", True) if user_permissions else True
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdateRequest,
    auth: dict = Depends(verify_auth)
):
    """Update current user information"""
    try:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Prevent users from changing their email address
        if update_data.email is not None:
            raise HTTPException(
                status_code=403,
                detail="Email address cannot be changed. Please contact your administrator."
            )
        
        # Get current user to preserve existing metadata
        async with httpx.AsyncClient() as client:
            get_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
                },
                timeout=10.0
            )
            
            if get_response.status_code != 200:
                raise HTTPException(status_code=404, detail="User not found")
            
            current_user_data = get_response.json()
            existing_metadata = current_user_data.get("user_metadata", {})
            
            update_fields = {}
            
            if update_data.name is not None:
                # Merge with existing metadata and set both 'name' and 'full_name' for compatibility
                update_fields["user_metadata"] = {
                    **existing_metadata,
                    "name": update_data.name,
                    "full_name": update_data.name  # Supabase Auth dashboard uses full_name
                }
            
            # Update user in Supabase Auth
            update_response = await client.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                json=update_fields,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if update_response.status_code != 200:
                error_data = update_response.json() if update_response.headers.get("content-type", "").startswith("application/json") else {}
                error_msg = error_data.get("message") or error_data.get("error") or "Failed to update user"
                raise HTTPException(status_code=400, detail=error_msg)
            
            updated_user_data = update_response.json()
            updated_user_metadata = updated_user_data.get("user_metadata", {})
            updated_email = updated_user_data.get("email", "")
            
            return UserResponse(
                user={
                    "id": user_id,
                    "email": updated_email,
                    "name": updated_user_metadata.get("name") or updated_email.split("@")[0] if updated_email else ""
                },
                role=None,
                permissions=None,
                isActive=True
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    password_data: ChangePasswordRequest,
    auth: dict = Depends(verify_auth)
):
    """Change user password"""
    try:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        user_data = auth.get("user", {})
        user_email = user_data.get("email")
        
        if not user_email:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Validate password length
        if len(password_data.newPassword) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
        # Validate password strength
        import re
        password_regex = r'^(?=.*[a-zA-Z])(?=.*\d)'
        if not re.match(password_regex, password_data.newPassword):
            raise HTTPException(
                status_code=400,
                detail="Password must contain at least one letter and one number"
            )
        
        # Check if new password is different from current password
        if password_data.currentPassword == password_data.newPassword:
            raise HTTPException(
                status_code=400,
                detail="New password must be different from current password"
            )
        
        async with httpx.AsyncClient() as client:
            # Verify current password by attempting to sign in
            verify_response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                json={
                    "email": user_email,
                    "password": password_data.currentPassword
                },
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if verify_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            
            # Get access token from verify response
            verify_data = verify_response.json()
            access_token = verify_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            
            # Update password
            update_response = await client.put(
                f"{SUPABASE_URL}/auth/v1/user",
                json={
                    "password": password_data.newPassword
                },
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if update_response.status_code != 200:
                error_data = update_response.json() if update_response.headers.get("content-type", "").startswith("application/json") else {}
                error_msg = error_data.get("message") or error_data.get("error") or "Failed to update password"
                raise HTTPException(status_code=400, detail=error_msg)
            
            return ChangePasswordResponse(message="Password changed successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(reset_data: ResetPasswordRequest):
    """Reset user password using recovery code"""
    try:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise HTTPException(status_code=500, detail="Server configuration error")
        
        # Validate password length
        if len(reset_data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
        async with httpx.AsyncClient() as client:
            # Handle both code and access_token formats
            session_data = None
            access_token = None
            
            if reset_data.code.startswith("pkce_"):
                # PKCE token - verify using verifyOtp
                verify_response = await client.post(
                    f"{SUPABASE_URL}/auth/v1/verify",
                    json={
                        "token_hash": reset_data.code,
                        "type": "recovery"
                    },
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Content-Type": "application/json"
                    },
                    timeout=10.0
                )
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    session_data = verify_data.get("session", {})
                    access_token = session_data.get("access_token") if session_data else None
            else:
                # Regular code format - exchange for session
                exchange_response = await client.post(
                    f"{SUPABASE_URL}/auth/v1/token?grant_type=authorization_code",
                    json={
                        "code": reset_data.code
                    },
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Content-Type": "application/json"
                    },
                    timeout=10.0
                )
                
                if exchange_response.status_code == 200:
                    exchange_data = exchange_response.json()
                    session_data = exchange_data.get("session", {})
                    access_token = session_data.get("access_token") if session_data else None
            
            if not access_token:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired reset code. Please request a new password reset."
                )
            
            # Update password using the session
            update_response = await client.put(
                f"{SUPABASE_URL}/auth/v1/user",
                json={
                    "password": reset_data.password
                },
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if update_response.status_code != 200:
                error_data = update_response.json() if update_response.headers.get("content-type", "").startswith("application/json") else {}
                error_msg = error_data.get("message") or error_data.get("error") or "Failed to update password"
                raise HTTPException(status_code=400, detail=error_msg)
            
            # Sign out the user after password reset
            await client.post(
                f"{SUPABASE_URL}/auth/v1/logout",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {access_token}"
                },
                timeout=10.0
            )
            
            return ResetPasswordResponse(message="Password reset successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

