from typing import List, Optional, Callable
from uuid import UUID

from app.network.node import Node
from app.network.connection import Connection
from app.models.action_packet import ActionPacket

class Manager:
    def __init__(self) -> None:
        self.nodes: List[Node] = []
        self.connections: List[Connection] = []

    def createNode(self, onPacketReceived: Optional[Callable[[ActionPacket], None]] = None) -> Node:
        node = Node(onPacketReceived=onPacketReceived)
        self.nodes.append(node)
        return node

    def createConnection(self, node1: Node, node2: Node) -> Connection:
        connection = Connection(node1, node2)
        self.connections.append(connection)
        return connection

    def createConnectionByUuids(self, uuid1: UUID, uuid2: UUID) -> Connection:
        node1 = self.getNodeByUuid(uuid1)
        node2 = self.getNodeByUuid(uuid2)
        if not node1 or not node2:
            raise ValueError("Node not found")
        return self.createConnection(node1, node2)

    def getNodeByUuid(self, uuid: UUID) -> Optional[Node]:
        for node in self.nodes:
            if node.uuid == uuid:
                return node
        return None
