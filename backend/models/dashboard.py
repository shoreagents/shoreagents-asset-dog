"""
Pydantic models for Dashboard API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class AssetValueGroupedItem(BaseModel):
    name: str
    value: float

class AssetValueGroupedResponse(BaseModel):
    data: List[AssetValueGroupedItem]

class DashboardStatsResponse(BaseModel):
    assetValueByCategory: List[AssetValueGroupedItem]
    activeCheckouts: List[Dict]
    recentCheckins: List[Dict]
    assetsUnderRepair: List[Dict]
    recentMoves: List[Dict]
    recentReserves: List[Dict]
    recentLeases: List[Dict]
    recentReturns: List[Dict]
    recentDisposes: List[Dict]
    recentAssets: List[Dict]
    feedCounts: Dict
    summary: Dict
    calendar: Dict

