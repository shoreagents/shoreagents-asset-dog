"""
File History API router
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import os
import json
import asyncio
from supabase import create_client, Client

from models.file_history import (
    FileHistoryCreate,
    FileHistoryResponse,
    FileHistoryListResponse,
    FileUploadResponse
)
from auth import verify_auth, SUPABASE_URL
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/file-history", tags=["file-history"])

def get_supabase_admin_client() -> Client:
    """Get Supabase admin client for storage operations"""
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key not configured"
        )
    return create_client(SUPABASE_URL, supabase_service_key)

async def check_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission"""
    try:
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        if not asset_user or not asset_user.isActive:
            return False
        return getattr(asset_user, permission, False)
    except Exception:
        return False

@router.get("", response_model=FileHistoryListResponse)
async def get_file_history(
    operationType: Optional[str] = Query(None, description="Filter by operation type: 'import' or 'export'"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get file history with pagination and optional filters"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Fetch user permissions from database
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        
        if not asset_user or not asset_user.isActive:
            raise HTTPException(status_code=403, detail="User not found or inactive")
        
        # Check permissions
        is_admin = asset_user.role == "admin"
        can_view_all_history = is_admin or (
            (operationType == "export" and (asset_user.canViewAssets or asset_user.canManageExport)) or
            (operationType == "import" and (asset_user.canViewAssets or asset_user.canManageImport))
        )
        
        can_view_import_history = is_admin or asset_user.canViewAssets or asset_user.canManageImport
        can_view_export_history = is_admin or asset_user.canViewAssets or asset_user.canManageExport
        
        # Build where clause
        where_clause: Dict[str, Any] = {}
        
        # Check if user can view at all
        if operationType == "export" and not can_view_export_history:
            raise HTTPException(status_code=403, detail="You do not have permission to view export history")
        
        if operationType == "import" and not can_view_import_history:
            raise HTTPException(status_code=403, detail="You do not have permission to view import history")
        
        if not can_view_all_history:
            where_clause["userId"] = user_id
        
        if operationType and operationType in ["import", "export"]:
            where_clause["operationType"] = operationType
        
        # Calculate pagination
        skip = (page - 1) * pageSize
        
        # Fetch file history with pagination
        file_history_data, total = await asyncio.gather(
            prisma.filehistory.find_many(
                where=where_clause,
                order={"createdAt": "desc"},
                skip=skip,
                take=pageSize,
            ),
            prisma.filehistory.count(where=where_clause)
        )
        
        # Fetch user emails from Supabase Auth
        unique_user_ids = list(set([h.userId for h in file_history_data]))
        user_email_map: Dict[str, str] = {}
        
        try:
            supabase_admin = get_supabase_admin_client()
            for uid in unique_user_ids:
                try:
                    auth_user = supabase_admin.auth.admin.get_user_by_id(uid)
                    if auth_user and hasattr(auth_user, 'user') and auth_user.user:
                        email = getattr(auth_user.user, 'email', None)
                        if email:
                            user_email_map[uid] = email
                except Exception as e:
                    logger.error(f"Failed to fetch user email for {uid}: {e}")
        except Exception as e:
            logger.error(f"Failed to create Supabase admin client: {e}")
        
        # Format response
        file_history_list = []
        for history in file_history_data:
            file_history_list.append(FileHistoryResponse(
                id=str(history.id),
                operationType=history.operationType,
                fileName=history.fileName,
                filePath=history.filePath,
                fileSize=history.fileSize,
                mimeType=history.mimeType,
                userId=history.userId,
                userEmail=user_email_map.get(history.userId),
                recordsProcessed=history.recordsProcessed,
                recordsCreated=history.recordsCreated,
                recordsSkipped=history.recordsSkipped,
                recordsFailed=history.recordsFailed,
                recordsExported=history.recordsExported,
                fieldsExported=history.fieldsExported,
                status=history.status,
                errorMessage=history.errorMessage,
                metadata=history.metadata,
                createdAt=history.createdAt,
                updatedAt=history.updatedAt,
            ))
        
        total_pages = (total + pageSize - 1) // pageSize if total > 0 else 0
        
        return FileHistoryListResponse(
            fileHistory=file_history_list,
            pagination={
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "totalPages": total_pages,
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch file history")

@router.post("", response_model=FileHistoryResponse, status_code=201)
async def create_file_history(
    file_history_data: FileHistoryCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new file history record"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Validate operationType
        if file_history_data.operationType not in ["import", "export"]:
            raise HTTPException(status_code=400, detail='operationType must be "import" or "export"')
        
        # Create file history record
        file_history = await prisma.filehistory.create(
            data={
                "operationType": file_history_data.operationType,
                "fileName": file_history_data.fileName,
                "filePath": file_history_data.filePath,
                "fileSize": file_history_data.fileSize,
                "mimeType": file_history_data.mimeType,
                "userId": user_id,
                "recordsProcessed": file_history_data.recordsProcessed,
                "recordsCreated": file_history_data.recordsCreated,
                "recordsSkipped": file_history_data.recordsSkipped,
                "recordsFailed": file_history_data.recordsFailed,
                "recordsExported": file_history_data.recordsExported,
                "fieldsExported": file_history_data.fieldsExported,
                "status": file_history_data.status,
                "errorMessage": file_history_data.errorMessage,
                "metadata": json.dumps(file_history_data.metadata) if file_history_data.metadata else None,
            }
        )
        
        return FileHistoryResponse(
            id=str(file_history.id),
            operationType=file_history.operationType,
            fileName=file_history.fileName,
            filePath=file_history.filePath,
            fileSize=file_history.fileSize,
            mimeType=file_history.mimeType,
            userId=file_history.userId,
            userEmail=None,
            recordsProcessed=file_history.recordsProcessed,
            recordsCreated=file_history.recordsCreated,
            recordsSkipped=file_history.recordsSkipped,
            recordsFailed=file_history.recordsFailed,
            recordsExported=file_history.recordsExported,
            fieldsExported=file_history.fieldsExported,
            status=file_history.status,
            errorMessage=file_history.errorMessage,
            metadata=file_history.metadata,
            createdAt=file_history.createdAt,
            updatedAt=file_history.updatedAt,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating file history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create file history: {str(e)}")

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    operationType: str = Form(...),
    auth: dict = Depends(verify_auth)
):
    """Upload a file to Supabase storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if operationType not in ["import", "export"]:
            raise HTTPException(status_code=400, detail='Invalid operationType. Must be "import" or "export"')
        
        # Create Supabase admin client
        try:
            supabase_admin = get_supabase_admin_client()
        except Exception as client_error:
            logger.error(f"Failed to create Supabase admin client: {client_error}")
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(":", "-").replace(".", "-")
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "xlsx"
        file_name = f"{operationType}-{timestamp}-{user_id}.{file_extension}"
        file_path = f"{operationType}/{file_name}"
        
        # Read file content
        file_content = await file.read()
        
        # Upload to Supabase storage bucket 'file-history'
        try:
            upload_response = supabase_admin.storage.from_("file-history").upload(
                file_path,
                file_content,
                file_options={
                    "content-type": file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "upsert": False,
                }
            )
            
            if upload_response and isinstance(upload_response, dict) and upload_response.get("error"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload file to storage: {upload_response.get('error')}"
                )
        except HTTPException:
            raise
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file to storage: {str(upload_error)}"
            )
        
        # Get public URL
        url_data = supabase_admin.storage.from_("file-history").get_public_url(file_path)
        public_url = url_data.get("publicUrl") if isinstance(url_data, dict) else (str(url_data) if url_data else None)
        
        return FileUploadResponse(
            filePath=file_path,
            fileName=file_name,
            fileSize=len(file_content),
            mimeType=file.content_type,
            publicUrl=public_url,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@router.get("/{file_history_id}", response_model=FileHistoryResponse)
async def get_file_history_by_id(
    file_history_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get a single file history record by ID"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        file_history = await prisma.filehistory.find_unique(
            where={"id": file_history_id}
        )
        
        if not file_history:
            raise HTTPException(status_code=404, detail="File history not found")
        
        # Verify user owns this file history
        if file_history.userId != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized to access this file")
        
        # Fetch user email
        user_email = None
        try:
            supabase_admin = get_supabase_admin_client()
            auth_user = supabase_admin.auth.admin.get_user_by_id(file_history.userId)
            if auth_user and hasattr(auth_user, 'user') and auth_user.user:
                user_email = getattr(auth_user.user, 'email', None)
        except Exception:
            pass
        
        return FileHistoryResponse(
            id=str(file_history.id),
            operationType=file_history.operationType,
            fileName=file_history.fileName,
            filePath=file_history.filePath,
            fileSize=file_history.fileSize,
            mimeType=file_history.mimeType,
            userId=file_history.userId,
            userEmail=user_email,
            recordsProcessed=file_history.recordsProcessed,
            recordsCreated=file_history.recordsCreated,
            recordsSkipped=file_history.recordsSkipped,
            recordsFailed=file_history.recordsFailed,
            recordsExported=file_history.recordsExported,
            fieldsExported=file_history.fieldsExported,
            status=file_history.status,
            errorMessage=file_history.errorMessage,
            metadata=file_history.metadata,
            createdAt=file_history.createdAt,
            updatedAt=file_history.updatedAt,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch file history")

@router.delete("/{file_history_id}")
async def delete_file_history(
    file_history_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a file history record and its associated file"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Fetch user permissions from database
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        
        if not asset_user or not asset_user.isActive:
            raise HTTPException(status_code=403, detail="User not found or inactive")
        
        # Fetch file history record
        file_history = await prisma.filehistory.find_unique(
            where={"id": file_history_id}
        )
        
        if not file_history:
            raise HTTPException(status_code=404, detail="File history not found")
        
        # Check permissions
        is_admin = asset_user.role == "admin"
        is_owner = file_history.userId == user_id
        can_delete = is_admin or (is_owner and (
            (file_history.operationType == "export" and asset_user.canManageExport) or
            (file_history.operationType == "import" and asset_user.canManageImport)
        ))
        
        if not can_delete:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this file history")
        
        # Delete file from Supabase storage if it exists
        if file_history.filePath:
            try:
                supabase_admin = get_supabase_admin_client()
                delete_response = supabase_admin.storage.from_("file-history").remove([file_history.filePath])
                if delete_response and isinstance(delete_response, dict) and delete_response.get("error"):
                    logger.error(f"Failed to delete file from storage: {delete_response.get('error')}")
            except Exception as storage_error:
                logger.error(f"Storage deletion error: {storage_error}")
                # Continue with database deletion even if storage deletion fails
        
        # Delete record from database
        await prisma.filehistory.delete(where={"id": file_history_id})
        
        return {"message": "File history deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete file history")

@router.get("/{file_history_id}/download")
async def download_file(
    file_history_id: str,
    auth: dict = Depends(verify_auth)
):
    """Download a file from Supabase storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Fetch file history record
        file_history = await prisma.filehistory.find_unique(
            where={"id": file_history_id}
        )
        
        if not file_history:
            raise HTTPException(status_code=404, detail="File history not found")
        
        # Verify user owns this file history
        if file_history.userId != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized to access this file")
        
        # Check if file exists in storage
        if not file_history.filePath:
            raise HTTPException(status_code=404, detail="File not found in storage")
        
        # Create Supabase admin client
        try:
            supabase_admin = get_supabase_admin_client()
        except Exception as client_error:
            logger.error(f"Failed to create Supabase admin client: {client_error}")
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        # Download file from storage
        try:
            download_response = supabase_admin.storage.from_("file-history").download(file_history.filePath)
            
            if not download_response:
                raise HTTPException(status_code=500, detail="Failed to download file from storage")
            
            # Supabase Python client returns bytes directly
            file_bytes = download_response if isinstance(download_response, bytes) else (
                bytes(download_response) if download_response else None
            )
            
            if not file_bytes:
                raise HTTPException(status_code=500, detail="Failed to download file from storage")
            
            # Return file with appropriate headers
            return StreamingResponse(
                iter([file_bytes]),
                media_type=file_history.mimeType or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{file_history.fileName}"',
                    "Content-Length": str(len(file_bytes)),
                }
            )
        except HTTPException:
            raise
        except Exception as download_error:
            logger.error(f"Storage download error: {download_error}")
            raise HTTPException(status_code=500, detail="Failed to download file from storage")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to download file")

