"""
Pydantic models for API requests and responses
"""
from .locations import (
    Location,
    LocationCreate,
    LocationUpdate,
    LocationsResponse,
    LocationResponse
)
from .sites import (
    Site,
    SiteCreate,
    SiteUpdate,
    SitesResponse,
    SiteResponse
)
from .departments import (
    Department,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentsResponse,
    DepartmentResponse
)

__all__ = [
    "Location",
    "LocationCreate",
    "LocationUpdate",
    "LocationsResponse",
    "LocationResponse",
    "Site",
    "SiteCreate",
    "SiteUpdate",
    "SitesResponse",
    "SiteResponse",
    "Department",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentsResponse",
    "DepartmentResponse",
]

