"""
Pydantic models for automated reports API
"""
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class AutomatedReportScheduleBase(BaseModel):
    reportName: str
    reportType: str
    frequency: str
    frequencyDay: Optional[int] = None
    frequencyMonth: Optional[int] = None
    scheduledTime: str
    emailRecipients: List[EmailStr]
    filters: Optional[Dict[str, Any]] = None
    format: str
    includeList: bool = True
    isActive: bool = True

    @field_validator('reportType')
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        valid_types = ['assets', 'checkout', 'location', 'maintenance', 'audit', 'depreciation', 'lease', 'reservation', 'transaction']
        if v not in valid_types:
            raise ValueError(f'Invalid report type. Must be one of: {", ".join(valid_types)}')
        return v

    @field_validator('frequency')
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        valid_frequencies = ['daily', 'weekly', 'monthly', 'yearly']
        if v not in valid_frequencies:
            raise ValueError(f'Invalid frequency. Must be one of: {", ".join(valid_frequencies)}')
        return v

    @field_validator('scheduledTime')
    @classmethod
    def validate_scheduled_time(cls, v: str) -> str:
        import re
        if not re.match(r'^([0-1][0-9]|2[0-3]):[0-5][0-9]$', v):
            raise ValueError('Invalid time format. Use HH:mm format (24-hour)')
        return v

    @field_validator('format')
    @classmethod
    def validate_format(cls, v: str) -> str:
        valid_formats = ['pdf', 'csv', 'excel']
        if v not in valid_formats:
            raise ValueError(f'Invalid format. Must be one of: {", ".join(valid_formats)}')
        return v

class AutomatedReportScheduleCreate(AutomatedReportScheduleBase):
    pass

class AutomatedReportScheduleUpdate(BaseModel):
    reportName: Optional[str] = None
    reportType: Optional[str] = None
    frequency: Optional[str] = None
    frequencyDay: Optional[int] = None
    frequencyMonth: Optional[int] = None
    scheduledTime: Optional[str] = None
    emailRecipients: Optional[List[EmailStr]] = None
    filters: Optional[Dict[str, Any]] = None
    format: Optional[str] = None
    includeList: Optional[bool] = None
    isActive: Optional[bool] = None

    @field_validator('reportType')
    @classmethod
    def validate_report_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_types = ['assets', 'checkout', 'location', 'maintenance', 'audit', 'depreciation', 'lease', 'reservation', 'transaction']
            if v not in valid_types:
                raise ValueError(f'Invalid report type. Must be one of: {", ".join(valid_types)}')
        return v

    @field_validator('frequency')
    @classmethod
    def validate_frequency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_frequencies = ['daily', 'weekly', 'monthly', 'yearly']
            if v not in valid_frequencies:
                raise ValueError(f'Invalid frequency. Must be one of: {", ".join(valid_frequencies)}')
        return v

    @field_validator('scheduledTime')
    @classmethod
    def validate_scheduled_time(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            import re
            if not re.match(r'^([0-1][0-9]|2[0-3]):[0-5][0-9]$', v):
                raise ValueError('Invalid time format. Use HH:mm format (24-hour)')
        return v

    @field_validator('format')
    @classmethod
    def validate_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_formats = ['pdf', 'csv', 'excel']
            if v not in valid_formats:
                raise ValueError(f'Invalid format. Must be one of: {", ".join(valid_formats)}')
        return v

class AutomatedReportSchedule(AutomatedReportScheduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lastSentAt: Optional[datetime] = None
    nextRunAt: Optional[datetime] = None
    createdBy: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class AutomatedReportScheduleResponse(BaseModel):
    schedule: AutomatedReportSchedule

class AutomatedReportScheduleListResponse(BaseModel):
    schedules: List[AutomatedReportSchedule]

class AutomatedReportScheduleDeleteResponse(BaseModel):
    success: bool

