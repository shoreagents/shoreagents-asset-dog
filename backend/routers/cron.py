"""
Cron job endpoints for scheduled tasks
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, List, Optional
import logging
import os
import base64
from datetime import datetime, timedelta, timezone
import httpx

from database import prisma
from utils.report_schedule import calculate_next_run_at, TIMEZONE_OFFSET_HOURS, LOCAL_TIMEZONE

# Try to import Resend for email sending
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    resend = None
    RESEND_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cron", tags=["cron"])


async def _generate_report_export(
    report_type: str,
    format: str,
    filters: Optional[Dict[str, Any]],
    include_list: bool,
    report_name: str
) -> Optional[Dict[str, Any]]:
    """Generate report export by calling the export endpoint"""
    try:
        # Export endpoints only support CSV and Excel, not PDF
        export_format = format
        if format == "pdf":
            export_format = "excel"
        
        # Map report types to export endpoints
        report_type_map = {
            "assets": "assets",
            "checkout": "checkout",
            "location": "location",
            "maintenance": "maintenance",
            "audit": "audit",
            "depreciation": "depreciation",
            "lease": "lease",
            "reservation": "reservation",
            "transaction": "transaction"
        }
        
        if report_type not in report_type_map:
            logger.warning(f"Unsupported report type: {report_type}")
            return None
        
        endpoint_name = report_type_map[report_type]
        
        # Get base URL for FastAPI
        base_url = os.getenv("FASTAPI_BASE_URL", "http://localhost:8000")
        export_url = f"{base_url}/api/reports/{endpoint_name}/export"
        
        # Build query parameters
        params: Dict[str, Any] = {"format": export_format}
        
        if filters:
            for key, value in filters.items():
                if value is not None and value != "":
                    params[key] = str(value)
        
        if include_list:
            params["includeAssetList"] = "true"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(export_url, params=params)
            
            if response.status_code != 200:
                logger.error(f"Failed to generate report: {response.status_code}")
                return None
            
            extension_map = {"pdf": "xlsx", "csv": "csv", "excel": "xlsx"}
            extension = extension_map.get(format, "xlsx")
            
            safe_name = ''.join(c if c.isalnum() else '_' for c in report_name.lower())
            date_str = datetime.now().strftime("%Y-%m-%d")
            filename = f"{safe_name}_{date_str}.{extension}"
            
            return {
                "filename": filename,
                "content": response.content,
                "mime_type": response.headers.get("content-type", "application/octet-stream")
            }
    
    except Exception as e:
        logger.error(f"Error generating report: {e}", exc_info=True)
        return None


async def _send_report_email(
    to: List[str],
    report_name: str,
    report_type: str,
    format: str,
    attachment: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Send report email using Resend"""
    if not RESEND_AVAILABLE:
        return {"success": False, "error": "Resend package not available"}
    
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        return {"success": False, "error": "RESEND_API_KEY not set"}
    
    try:
        resend.api_key = resend_api_key
        from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
        site_name = os.getenv("NEXT_PUBLIC_SITE_NAME", "Asset Dog")
        
        email_html = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">{site_name}</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Scheduled Report: {report_name}</h2>
              <p style="color: #666; font-size: 16px;">
                Your scheduled {report_type} report is attached.
              </p>
              <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 5px 0;"><strong>Report Type:</strong> {report_type}</p>
                <p style="margin: 5px 0;"><strong>Format:</strong> {format.upper()}</p>
                <p style="margin: 5px 0;"><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
              </div>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; {datetime.now().year} {site_name}. All rights reserved.</p>
            </div>
          </body>
        </html>
        """
        
        email_params: Dict[str, Any] = {
            "from": from_email,
            "to": to,
            "subject": f"Scheduled Report: {report_name}",
            "html": email_html,
        }
        
        if attachment:
            content = attachment["content"]
            if isinstance(content, bytes):
                content_b64 = base64.b64encode(content).decode('utf-8')
            else:
                content_b64 = content
            
            email_params["attachments"] = [
                resend.Attachment(
                    filename=attachment["filename"],
                    content=content_b64,
                )
            ]
        
        result = resend.Emails.send(email_params)
        
        email_id = None
        if hasattr(result, 'id'):
            email_id = result.id
        elif isinstance(result, dict) and 'id' in result:
            email_id = result['id']
        
        if email_id:
            return {"success": True, "email_id": email_id}
        
        return {"success": False, "error": "No email ID returned"}
    
    except Exception as e:
        logger.error(f"Error sending email: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/send-scheduled-reports")
async def send_scheduled_reports(request: Request):
    """
    Cron job endpoint for sending scheduled automated reports.
    
    Configure Railway/external cron to call this endpoint periodically.
    Set CRON_SECRET environment variable for security.
    
    Example cron schedule: Every hour -> 0 * * * *
    """
    # Verify cron secret for security
    auth_header = request.headers.get("authorization")
    cron_secret = os.getenv("CRON_SECRET")
    
    if cron_secret and auth_header != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        # Use local timezone for comparison since nextRunAt is stored in local time
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone(LOCAL_TIMEZONE)
        # Convert to naive datetime for Prisma comparison (strip timezone info)
        now_naive = now_local.replace(tzinfo=None)
        
        logger.info(f"Checking for due schedules at local time: {now_naive}")
        
        # Find all active schedules that are due to run
        due_schedules = await prisma.automatedreportschedule.find_many(
            where={
                "isActive": True,
                "nextRunAt": {"lte": now_naive}
            }
        )
        
        if not due_schedules:
            return {
                "success": True,
                "message": "No scheduled reports due",
                "processedCount": 0
            }
        
        results = []
        
        for schedule in due_schedules:
            schedule_result = {
                "id": schedule.id,
                "reportName": schedule.reportName,
                "success": False,
                "error": None
            }
            
            try:
                # Generate report
                filters_dict = schedule.filters if isinstance(schedule.filters, dict) else {}
                attachment = await _generate_report_export(
                    report_type=schedule.reportType,
                    format=schedule.format or "excel",
                    filters=filters_dict,
                    include_list=schedule.includeList if schedule.includeList is not None else True,
                    report_name=schedule.reportName
                )
                
                # Send email
                email_result = await _send_report_email(
                    to=schedule.emailRecipients,
                    report_name=schedule.reportName,
                    report_type=schedule.reportType,
                    format=schedule.format or "excel",
                    attachment=attachment
                )
                
                if email_result.get("success"):
                    # Update last sent and next run time
                    next_run = calculate_next_run_at(
                        frequency=schedule.frequency,
                        frequency_day=schedule.frequencyDay,
                        frequency_month=schedule.frequencyMonth,
                        scheduled_time=schedule.scheduledTime or "02:00"
                    )
                    
                    await prisma.automatedreportschedule.update(
                        where={"id": schedule.id},
                        data={
                            "lastSentAt": now_naive,
                            "nextRunAt": next_run
                        }
                    )
                    
                    schedule_result["success"] = True
                    logger.info(f"Sent scheduled report: {schedule.reportName}")
                else:
                    schedule_result["error"] = email_result.get("error", "Unknown error")
                    logger.error(f"Failed to send scheduled report {schedule.reportName}: {schedule_result['error']}")
            
            except Exception as e:
                schedule_result["error"] = str(e)
                logger.error(f"Error processing schedule {schedule.id}: {e}", exc_info=True)
            
            results.append(schedule_result)
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "success": True,
            "message": f"Processed {len(results)} scheduled reports, {success_count} sent successfully",
            "processedCount": len(results),
            "successCount": success_count,
            "results": results
        }
    
    except Exception as e:
        logger.error(f"Cron job error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

