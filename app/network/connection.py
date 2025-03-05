from uuid import UUID

from app.network.node import Node
from app.models.action_packet import ActionPacket

class Connection:
    def __init__(self, node1: Node, node2: Node) -> None:
        self.node1 = node1
        self.node2 = node2
        self.node1.connections.append(self)
        self.node2.connections.append(self)

    def hasNode(self, uuid: UUID) -> bool:
        return self.node1.uuid == uuid or self.node2.uuid == uuid

    def transferPacket(self, sender: Node, packet: ActionPacket) -> None:
        packetCopy = packet.model_copy(deep=True)
        if sender == self.node1:
            self.node2.receivePacket(packetCopy)
        elif sender == self.node2:
            self.node1.receivePacket(packetCopy)
        else:
            raise ValueError("Sender is not connected to this connection")

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
