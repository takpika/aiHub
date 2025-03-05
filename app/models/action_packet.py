from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from app.enums.action_type import ActionType

class ActionPacket(BaseModel):
    type: ActionType
    sender: UUID
    recipient: Optional[UUID] = None
    context: Optional[str] = None
    ttl: int = 128
    originalTtl: int = 128
