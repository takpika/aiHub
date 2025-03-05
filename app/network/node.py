from typing import Callable, Optional, List, TYPE_CHECKING
from uuid import UUID
from uuid6 import uuid7

from app.models.action_packet import ActionPacket

if TYPE_CHECKING:
    from app.network.connection import Connection

class Node:
    def __init__(
        self,
        uuid: Optional[UUID] = None,
        onPacketReceived: Optional[Callable[[ActionPacket], None]] = None
    ) -> None:
        self.uuid = uuid or uuid7()
        self.connections: List["Connection"] = []
        self.onPacketReceived = onPacketReceived

    def addConnection(self, connection: "Connection") -> None:
        self.connections.append(connection)

    def removeConnection(self, connection: "Connection") -> None:
        if connection in self.connections:
            self.connections.remove(connection)

    def sendPacket(self, recipient: Optional[UUID], packet: ActionPacket) -> None:
        if packet.ttl <= 0:
            return
        packet.ttl -= 1
        if recipient:
            for connection in self.connections:
                if connection.hasNode(recipient):
                    connection.transferPacket(self, packet)
                    return
            raise ValueError("Recipient is not connected to this node")
        else:
            for connection in self.connections:
                connection.transferPacket(self, packet)

    def receivePacket(self, packet: ActionPacket) -> None:
        if self.onPacketReceived:
            self.onPacketReceived(packet)
