from typing import Optional, TYPE_CHECKING
from uuid import UUID

from app.network.node import Node
from app.models.action_packet import ActionPacket

if TYPE_CHECKING:
    from app.network.manager import Manager


class Connection:
    def __init__(
        self,
        node1: Node,
        node2: Node,
        manager: Optional["Manager"] = None,
    ) -> None:
        self.node1 = node1
        self.node2 = node2
        self.manager = manager or getattr(node1, "manager", None) or getattr(node2, "manager", None)
        self.node1.connections.append(self)
        self.node2.connections.append(self)

    def hasNode(self, uuid: UUID) -> bool:
        return self.node1.uuid == uuid or self.node2.uuid == uuid

    def transferPacket(self, sender: Node, packet: ActionPacket) -> None:
        packetCopy = packet.model_copy(deep=True)
        if sender == self.node1:
            target = self.node2
        elif sender == self.node2:
            target = self.node1
        else:
            raise ValueError("Sender is not connected to this connection")
        self._notifyPacketTransfer(sender, target, packetCopy)
        target.receivePacket(packetCopy)

    def getPeerUuid(self, node: Node) -> UUID:
        if node == self.node1:
            return self.node2.uuid
        elif node == self.node2:
            return self.node1.uuid
        else:
            raise ValueError("Node is not connected to this connection")

    def disconnect(self) -> None:
        self.node1.removeConnection(self)
        self.node2.removeConnection(self)

    def _notifyPacketTransfer(self, source: Node, target: Node, packet: ActionPacket) -> None:
        manager = self.manager or getattr(source, "manager", None) or getattr(target, "manager", None)
        if not manager:
            return
        try:
            manager.notifyPacketTransfer(source, target, packet)
        except Exception:
            # Ignore notification failures so packets still flow.
            pass
