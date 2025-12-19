"""
Users API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Path, Body
from typing import Optional
import logging
import os
import secrets
import string
import httpx
from dotenv import load_dotenv

from models.users import (
    User,
    UsersResponse,
    UserResponse,
    CreateUserRequest,
    CreateUserResponse,
    UpdateUserRequest,
    DeleteUserResponse,
    SendPasswordResetResponse,
    PaginationInfo,
)
from auth import verify_auth
from database import prisma

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")


def generate_random_password(length: int = 12) -> str:
    """Generate a random password"""
    charset = string.ascii_letters + string.digits + "!@#$%^&*()_+-=[]{}|;:,.<>?/~`"
    return ''.join(secrets.choice(charset) for _ in range(length))


async def get_supabase_user_by_id(user_id: str) -> dict:
    """Get user from Supabase Auth by ID"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
            },
            timeout=10.0
        )
        
        if response.status_code != 200:
            return {}
        
        return response.json()


async def create_supabase_user(email: str, password: str, name: Optional[str] = None) -> dict:
    """Create user in Supabase Auth"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    user_metadata = {}
    if name:
        user_metadata = {"name": name, "full_name": name}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": user_metadata if user_metadata else None,
            },
            timeout=10.0
        )
        
        if response.status_code not in [200, 201]:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get("message", error_data.get("msg", "Failed to create user"))
            
            if "already registered" in error_msg.lower() or "already exists" in error_msg.lower():
                raise HTTPException(status_code=409, detail="User already exists")
            
            raise HTTPException(status_code=response.status_code, detail=error_msg)
        
        return response.json()


async def update_supabase_user(user_id: str, name: Optional[str] = None) -> dict:
    """Update user in Supabase Auth"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    # Get current user metadata
    current_user = await get_supabase_user_by_id(user_id)
    existing_metadata = current_user.get("user_metadata", {}) if current_user else {}
    
    # Update metadata with name
    updated_metadata = {
        **existing_metadata,
        "name": name or None,
        "full_name": name or None,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            json={
                "user_metadata": updated_metadata,
            },
            timeout=10.0
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to update Supabase user: {response.text}")
        
        return response.json() if response.status_code == 200 else {}


async def delete_supabase_user(user_id: str) -> bool:
    """Delete user from Supabase Auth"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
            },
            timeout=10.0
        )
        
        if response.status_code not in [200, 204]:
            logger.error(f"Failed to delete Supabase user: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to delete user from authentication system")
        
        return True


async def send_password_reset_email(email: str) -> dict:
    """Send password reset email via Supabase"""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    # Get redirect URL
    base_url = os.getenv("NEXT_PUBLIC_SITE_URL") or os.getenv("NEXT_PUBLIC_APP_URL") or "http://localhost:3000"
    redirect_to = f"{base_url}/reset-password"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/recover",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "redirect_to": redirect_to,
            },
            timeout=10.0
        )
        
        if response.status_code not in [200, 204]:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get("message", error_data.get("msg", "Failed to send password reset email"))
            raise HTTPException(status_code=400, detail=error_msg)
        
        return {"success": True}


def user_to_response(db_user, email: Optional[str] = None, name: Optional[str] = None) -> User:
    """Convert database user to response model"""
    return User(
        id=db_user.id,
        userId=db_user.userId,
        email=email or "-",
        name=name,
        role=db_user.role,
        isActive=db_user.isActive,
        isApproved=db_user.isApproved,
        canDeleteAssets=db_user.canDeleteAssets,
        canManageImport=db_user.canManageImport,
        canManageExport=db_user.canManageExport,
        canCreateAssets=db_user.canCreateAssets,
        canEditAssets=db_user.canEditAssets,
        canViewAssets=db_user.canViewAssets,
        canManageEmployees=db_user.canManageEmployees,
        canManageSetup=db_user.canManageSetup,
        canCheckout=db_user.canCheckout,
        canCheckin=db_user.canCheckin,
        canReserve=db_user.canReserve,
        canMove=db_user.canMove,
        canLease=db_user.canLease,
        canDispose=db_user.canDispose,
        canManageMaintenance=db_user.canManageMaintenance,
        canAudit=db_user.canAudit,
        canManageMedia=db_user.canManageMedia,
        canManageTrash=db_user.canManageTrash,
        canManageUsers=db_user.canManageUsers,
        canManageReturnForms=db_user.canManageReturnForms,
        canViewReturnForms=db_user.canViewReturnForms,
        canManageAccountabilityForms=db_user.canManageAccountabilityForms,
        canViewAccountabilityForms=db_user.canViewAccountabilityForms,
        canManageReports=db_user.canManageReports,
        canManageInventory=db_user.canManageInventory,
        createdAt=db_user.createdAt,
        updatedAt=db_user.updatedAt,
    )


@router.get("", response_model=UsersResponse)
async def get_users(
    search: Optional[str] = Query(None, description="Search term"),
    searchType: str = Query("unified", description="Search type: unified, email, userId, role"),
    role: Optional[str] = Query(None, description="Filter by role"),
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(50, ge=1, le=100, description="Page size"),
    auth: dict = Depends(verify_auth)
):
    """Get all users with pagination and search"""
    try:
        skip = (page - 1) * pageSize
        
        # Build where clause for role filter
        where_clause = {}
        if role and role != "all":
            where_clause["role"] = role
        
        users = []
        total_count = 0
        
        if search:
            # Fetch all users to search (since email is in Supabase Auth)
            all_users = await prisma.assetuser.find_many(
                where=where_clause if where_clause else None,
                order={"createdAt": "desc"},
                take=10000,  # Reasonable limit for search
            )
            
            # Fetch emails and names from Supabase Auth
            users_with_email = []
            for user in all_users:
                try:
                    auth_user = await get_supabase_user_by_id(user.userId)
                    email = auth_user.get("email") if auth_user else None
                    user_metadata = auth_user.get("user_metadata", {}) if auth_user else {}
                    name = user_metadata.get("name") or user_metadata.get("full_name")
                    users_with_email.append({
                        "db_user": user,
                        "email": email,
                        "name": name,
                    })
                except Exception:
                    users_with_email.append({
                        "db_user": user,
                        "email": None,
                        "name": None,
                    })
            
            # Filter by search term
            search_lower = search.lower()
            filtered_users = []
            for user_data in users_with_email:
                db_user = user_data["db_user"]
                email = user_data["email"] or ""
                
                if searchType == "email":
                    if email.lower().find(search_lower) >= 0:
                        filtered_users.append(user_data)
                elif searchType == "userId":
                    if db_user.userId.lower().find(search_lower) >= 0:
                        filtered_users.append(user_data)
                elif searchType == "role":
                    if db_user.role.lower().find(search_lower) >= 0:
                        filtered_users.append(user_data)
                else:  # unified
                    email_match = email.lower().find(search_lower) >= 0
                    user_id_match = db_user.userId.lower().find(search_lower) >= 0
                    role_match = db_user.role.lower().find(search_lower) >= 0
                    if email_match or user_id_match or role_match:
                        filtered_users.append(user_data)
            
            total_count = len(filtered_users)
            
            # Apply pagination
            paginated_users = filtered_users[skip:skip + pageSize]
            users = [
                user_to_response(u["db_user"], u["email"], u["name"])
                for u in paginated_users
            ]
        else:
            # No search term - normal query with pagination
            total_count = await prisma.assetuser.count(where=where_clause if where_clause else None)
            
            db_users = await prisma.assetuser.find_many(
                where=where_clause if where_clause else None,
                order={"createdAt": "desc"},
                skip=skip,
                take=pageSize,
            )
            
            # Fetch emails and names from Supabase Auth
            for db_user in db_users:
                try:
                    auth_user = await get_supabase_user_by_id(db_user.userId)
                    email = auth_user.get("email") if auth_user else None
                    user_metadata = auth_user.get("user_metadata", {}) if auth_user else {}
                    name = user_metadata.get("name") or user_metadata.get("full_name")
                    users.append(user_to_response(db_user, email, name))
                except Exception:
                    users.append(user_to_response(db_user, None, None))
        
        total_pages = (total_count + pageSize - 1) // pageSize if total_count > 0 else 1
        
        return UsersResponse(
            users=users,
            pagination=PaginationInfo(
                page=page,
                pageSize=pageSize,
                total=total_count,
                totalPages=total_pages,
                hasNextPage=page < total_pages,
                hasPreviousPage=page > 1,
            )
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching users: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.post("", response_model=CreateUserResponse, status_code=201)
async def create_user(
    request: CreateUserRequest = Body(...),
    auth: dict = Depends(verify_auth)
):
    """Create a new user"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Generate password if not provided
        user_password = request.password or generate_random_password()
        
        # Create user in Supabase Auth
        auth_user = await create_supabase_user(request.email, user_password, request.name)
        
        supabase_user_id = auth_user.get("id")
        if not supabase_user_id:
            raise HTTPException(status_code=400, detail="Failed to create user")
        
        # Build permissions data (only for "user" role)
        permissions_data = {}
        if request.role == "user" and request.permissions:
            permissions_data = {
                "canDeleteAssets": request.permissions.canDeleteAssets or False,
                "canManageImport": request.permissions.canManageImport or False,
                "canManageExport": request.permissions.canManageExport if request.permissions.canManageExport is not None else True,
                "canCreateAssets": request.permissions.canCreateAssets if request.permissions.canCreateAssets is not None else True,
                "canEditAssets": request.permissions.canEditAssets if request.permissions.canEditAssets is not None else True,
                "canViewAssets": request.permissions.canViewAssets if request.permissions.canViewAssets is not None else True,
                "canManageEmployees": request.permissions.canManageEmployees or False,
                "canManageSetup": request.permissions.canManageSetup or False,
                "canCheckout": request.permissions.canCheckout if request.permissions.canCheckout is not None else True,
                "canCheckin": request.permissions.canCheckin if request.permissions.canCheckin is not None else True,
                "canReserve": request.permissions.canReserve if request.permissions.canReserve is not None else True,
                "canMove": request.permissions.canMove or False,
                "canLease": request.permissions.canLease or False,
                "canDispose": request.permissions.canDispose or False,
                "canManageMaintenance": request.permissions.canManageMaintenance or False,
                "canAudit": request.permissions.canAudit or False,
                "canManageMedia": request.permissions.canManageMedia if request.permissions.canManageMedia is not None else True,
                "canManageTrash": request.permissions.canManageTrash if request.permissions.canManageTrash is not None else True,
                "canManageUsers": request.permissions.canManageUsers or False,
                "canManageReturnForms": request.permissions.canManageReturnForms or False,
                "canViewReturnForms": request.permissions.canViewReturnForms if request.permissions.canViewReturnForms is not None else True,
                "canManageAccountabilityForms": request.permissions.canManageAccountabilityForms or False,
                "canViewAccountabilityForms": request.permissions.canViewAccountabilityForms if request.permissions.canViewAccountabilityForms is not None else True,
                "canManageReports": request.permissions.canManageReports or False,
                "canManageInventory": request.permissions.canManageInventory or False,
            }
        
        # Create asset_users record
        db_user = await prisma.assetuser.create(
            data={
                "userId": supabase_user_id,
                "role": request.role,
                "isApproved": True,  # Automatically approve accounts created by admin
                **permissions_data,
            }
        )
        
        # TODO: Send welcome email (implement email service)
        email_sent = False
        email_error = None
        
        user_response = user_to_response(db_user, request.email, request.name)
        
        return CreateUserResponse(
            user=user_response,
            generatedPassword=user_password if not request.password else None,
            emailSent=email_sent,
            emailError=email_error,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {type(e).__name__}: {str(e)}", exc_info=True)
        if "unique constraint" in str(e).lower() or "p2002" in str(e).lower():
            raise HTTPException(status_code=409, detail="User already exists")
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str = Path(..., description="User ID"),
    auth: dict = Depends(verify_auth)
):
    """Get a user by ID"""
    try:
        auth_user_id = auth.get("user", {}).get("id")
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        db_user = await prisma.assetuser.find_unique(where={"id": user_id})
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get email and name from Supabase Auth
        try:
            auth_user = await get_supabase_user_by_id(db_user.userId)
            email = auth_user.get("email") if auth_user else None
            user_metadata = auth_user.get("user_metadata", {}) if auth_user else {}
            name = user_metadata.get("name") or user_metadata.get("full_name")
        except Exception:
            email = None
            name = None
        
        return UserResponse(user=user_to_response(db_user, email, name))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user")


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str = Path(..., description="User ID"),
    request: UpdateUserRequest = Body(...),
    auth: dict = Depends(verify_auth)
):
    """Update a user"""
    try:
        auth_user_id = auth.get("user", {}).get("id")
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get the user being updated
        user_to_update = await prisma.assetuser.find_unique(where={"id": user_id})
        
        if not user_to_update:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent user from changing their own role
        if user_to_update.userId == auth_user_id and user_to_update.role != request.role:
            raise HTTPException(status_code=403, detail="You cannot change your own role")
        
        # Prevent user from setting their own status to inactive
        if user_to_update.userId == auth_user_id and request.isActive is False:
            raise HTTPException(status_code=403, detail="You cannot set your own status to inactive")
        
        # Build update data
        update_data = {
            "role": request.role,
            "isActive": request.isActive if request.isActive is not None else True,
        }
        
        if request.isApproved is not None:
            update_data["isApproved"] = request.isApproved
        
        # Add permissions only for "user" role
        if request.role == "user" and request.permissions:
            update_data.update({
                "canDeleteAssets": request.permissions.canDeleteAssets if request.permissions.canDeleteAssets is not None else False,
                "canManageImport": request.permissions.canManageImport if request.permissions.canManageImport is not None else False,
                "canManageExport": request.permissions.canManageExport if request.permissions.canManageExport is not None else True,
                "canCreateAssets": request.permissions.canCreateAssets if request.permissions.canCreateAssets is not None else True,
                "canEditAssets": request.permissions.canEditAssets if request.permissions.canEditAssets is not None else True,
                "canViewAssets": request.permissions.canViewAssets if request.permissions.canViewAssets is not None else True,
                "canManageEmployees": request.permissions.canManageEmployees if request.permissions.canManageEmployees is not None else False,
                "canManageSetup": request.permissions.canManageSetup if request.permissions.canManageSetup is not None else False,
                "canCheckout": request.permissions.canCheckout if request.permissions.canCheckout is not None else True,
                "canCheckin": request.permissions.canCheckin if request.permissions.canCheckin is not None else True,
                "canReserve": request.permissions.canReserve if request.permissions.canReserve is not None else True,
                "canMove": request.permissions.canMove if request.permissions.canMove is not None else False,
                "canLease": request.permissions.canLease if request.permissions.canLease is not None else False,
                "canDispose": request.permissions.canDispose if request.permissions.canDispose is not None else False,
                "canManageMaintenance": request.permissions.canManageMaintenance if request.permissions.canManageMaintenance is not None else False,
                "canAudit": request.permissions.canAudit if request.permissions.canAudit is not None else False,
                "canManageMedia": request.permissions.canManageMedia if request.permissions.canManageMedia is not None else True,
                "canManageTrash": request.permissions.canManageTrash if request.permissions.canManageTrash is not None else True,
                "canManageUsers": request.permissions.canManageUsers if request.permissions.canManageUsers is not None else False,
                "canManageReturnForms": request.permissions.canManageReturnForms if request.permissions.canManageReturnForms is not None else False,
                "canViewReturnForms": request.permissions.canViewReturnForms if request.permissions.canViewReturnForms is not None else True,
                "canManageAccountabilityForms": request.permissions.canManageAccountabilityForms if request.permissions.canManageAccountabilityForms is not None else False,
                "canViewAccountabilityForms": request.permissions.canViewAccountabilityForms if request.permissions.canViewAccountabilityForms is not None else True,
                "canManageReports": request.permissions.canManageReports if request.permissions.canManageReports is not None else False,
                "canManageInventory": request.permissions.canManageInventory if request.permissions.canManageInventory is not None else False,
            })
        
        # Update the user
        db_user = await prisma.assetuser.update(
            where={"id": user_id},
            data=update_data,
        )
        
        # Update name in Supabase Auth if provided
        if request.name is not None:
            await update_supabase_user(db_user.userId, request.name)
        
        # Get email and name from Supabase Auth
        try:
            auth_user = await get_supabase_user_by_id(db_user.userId)
            email = auth_user.get("email") if auth_user else None
            user_metadata = auth_user.get("user_metadata", {}) if auth_user else {}
            name = user_metadata.get("name") or user_metadata.get("full_name")
        except Exception:
            email = None
            name = None
        
        return UserResponse(user=user_to_response(db_user, email, name))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {type(e).__name__}: {str(e)}", exc_info=True)
        if "p2025" in str(e).lower():
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.delete("/{user_id}", response_model=DeleteUserResponse)
async def delete_user(
    user_id: str = Path(..., description="User ID"),
    auth: dict = Depends(verify_auth)
):
    """Delete a user"""
    try:
        auth_user_id = auth.get("user", {}).get("id")
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get the user being deleted
        user_to_delete = await prisma.assetuser.find_unique(where={"id": user_id})
        
        if not user_to_delete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent user from deleting their own account
        if user_to_delete.userId == auth_user_id:
            raise HTTPException(status_code=403, detail="You cannot delete your own account")
        
        # Delete from Supabase Auth first
        await delete_supabase_user(user_to_delete.userId)
        
        # Delete from asset_users
        await prisma.assetuser.delete(where={"id": user_id})
        
        return DeleteUserResponse(success=True)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {type(e).__name__}: {str(e)}", exc_info=True)
        if "p2025" in str(e).lower():
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=500, detail="Failed to delete user")


@router.post("/{user_id}/send-password-reset", response_model=SendPasswordResetResponse)
async def send_password_reset(
    user_id: str = Path(..., description="User ID"),
    auth: dict = Depends(verify_auth)
):
    """Send password reset email to user"""
    try:
        auth_user_id = auth.get("user", {}).get("id")
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get user from database
        db_user = await prisma.assetuser.find_unique(where={"id": user_id})
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user email from Supabase Auth
        auth_user = await get_supabase_user_by_id(db_user.userId)
        
        if not auth_user or not auth_user.get("email"):
            raise HTTPException(status_code=400, detail="Failed to retrieve user email")
        
        user_email = auth_user["email"]
        
        # Send password reset email
        await send_password_reset_email(user_email)
        
        return SendPasswordResetResponse(
            message="Password reset email sent successfully",
            email=user_email,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending password reset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to send password reset email")

