from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class RoomHubInfo(BaseModel):
    uuid: UUID
    name: str
    connectedHubs: List[UUID]
    connectedDevices: List[UUID]


class DeviceInfo(BaseModel):
    uuid: UUID
    name: str
    hubUuid: Optional[UUID]
    privacyMode: bool
    model: str
    isReasoning: bool
    debug: bool
    coolTime: float
    timeOut: float
    situation: str
    runAI: bool


class CreateRoomHubRequest(BaseModel):
    name: str


class HubConnectionRequest(BaseModel):
    targetHubUuid: UUID


class CreateDeviceRequest(BaseModel):
    name: str
    situation: str = ""
    runAI: bool = True
    model: str = "gpt-4o"
    isReasoning: bool = False
    debug: bool = False
    coolTime: float = 0.2
    timeOut: float = 10
    hubUuid: Optional[UUID] = None


class UpdateDeviceHubRequest(BaseModel):
    hubUuid: UUID
