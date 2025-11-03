from typing import List, Optional, Callable, TYPE_CHECKING
from uuid import UUID

from app.network.node import Node
from app.network.connection import Connection
from app.models.action_packet import ActionPacket

if TYPE_CHECKING:
    from app.network.devices.room_hub import RoomHub
    from app.network.devices.ai_device import AIDevice

class Manager:
    def __init__(self) -> None:
        self.nodes: List[Node] = []
        self.connections: List[Connection] = []
        self.roomHubs: List["RoomHub"] = []
        self.devices: List["AIDevice"] = []

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

    def createRoomHub(self, name: str) -> "RoomHub":
        from app.network.devices.room_hub import RoomHub

        return RoomHub(name=name, manager=self)

    def getRoomHubByUuid(self, uuid: UUID) -> Optional["RoomHub"]:
        for hub in self.roomHubs:
            if hub.node.uuid == uuid:
                return hub
        return None

    def getDeviceByUuid(self, uuid: UUID) -> Optional["AIDevice"]:
        for device in self.devices:
            if device.node.uuid == uuid:
                return device
        return None

    def createAIDevice(
        self,
        name: str,
        *,
        situation: str = "",
        runAI: bool = True,
        model: str = "gpt-4o",
        isReasoning: bool = False,
        debug: bool = False,
        coolTime: float = 0.2,
        timeOut: float = 10,
    ) -> "AIDevice":
        from openai import OpenAI
        from app.network.devices.ai_device import AIDevice

        client = OpenAI()
        return AIDevice(
            name=name,
            manager=self,
            client=client,
            situation=situation,
            runAI=runAI,
            model=model,
            isReasoning=isReasoning,
            debug=debug,
            coolTime=coolTime,
            timeOut=timeOut,
        )

    def setDeviceHub(self, deviceUuid: UUID, hubUuid: UUID) -> None:
        device = self.getDeviceByUuid(deviceUuid)
        if not device:
            raise ValueError("Device not found")

        hub = self.getRoomHubByUuid(hubUuid)
        if not hub:
            raise ValueError("Hub not found")

        if device.hubUuid == hubUuid:
            return

        if device.hubUuid is None:
            device.joinHub(hubUuid)
            return

        previousHubUuid = device.hubUuid
        device.leaveHub()
        if previousHubUuid:
            try:
                self.removeConnectionByUuids(device.node.uuid, previousHubUuid)
            except ValueError:
                pass
            previousHub = self.getRoomHubByUuid(previousHubUuid)
            if previousHub and device.node.uuid in previousHub.connectedDevices:
                previousHub.connectedDevices.remove(device.node.uuid)

        device.joinHub(hubUuid)

    def deleteDevice(self, uuid: UUID) -> None:
        device = self.getDeviceByUuid(uuid)

        if not device:
            raise ValueError("Device not found")

        previousHubUuid = device.hubUuid
        if previousHubUuid:
            try:
                device.leaveHub()
            except ValueError:
                pass
            try:
                self.removeConnectionByUuids(device.node.uuid, previousHubUuid)
            except ValueError:
                pass
            hub = self.getRoomHubByUuid(previousHubUuid)
            if hub and device.node.uuid in hub.connectedDevices:
                hub.connectedDevices.remove(device.node.uuid)

        self._removeConnectionsForNode(device.node)

        if device in self.devices:
            self.devices.remove(device)
        if device.node in self.nodes:
            self.nodes.remove(device.node)

    def connectRoomHubs(self, uuid1: UUID, uuid2: UUID) -> None:
        if uuid1 == uuid2:
            raise ValueError("Cannot connect a hub to itself")

        hub1 = self.getRoomHubByUuid(uuid1)
        hub2 = self.getRoomHubByUuid(uuid2)

        if not hub1 or not hub2:
            raise ValueError("Hub not found")

        if hub1.isHubConnected(uuid2):
            raise ValueError("Hubs are already connected")

        hub1.connectHub(hub2)

    def _removeConnection(self, connection: Connection) -> None:
        connection.disconnect()
        if connection in self.connections:
            self.connections.remove(connection)

    def _removeConnectionsForNode(self, node: Node) -> None:
        for connection in list(self.connections):
            if connection.node1 == node or connection.node2 == node:
                self._removeConnection(connection)

    def removeConnectionByUuids(self, uuid1: UUID, uuid2: UUID) -> None:
        node1 = self.getNodeByUuid(uuid1)
        node2 = self.getNodeByUuid(uuid2)

        if not node1 or not node2:
            raise ValueError("Node not found")

        removed = False
        for connection in list(self.connections):
            if (
                (connection.node1 == node1 and connection.node2 == node2)
                or (connection.node1 == node2 and connection.node2 == node1)
            ):
                self._removeConnection(connection)
                removed = True

        if not removed:
            raise ValueError("Connection not found")

    def disconnectRoomHubs(self, uuid1: UUID, uuid2: UUID) -> None:
        hub1 = self.getRoomHubByUuid(uuid1)
        hub2 = self.getRoomHubByUuid(uuid2)

        if not hub1 or not hub2:
            raise ValueError("Hub not found")

        if not hub1.isHubConnected(uuid2):
            raise ValueError("Hubs are not connected")

        self.removeConnectionByUuids(hub1.node.uuid, hub2.node.uuid)

        if uuid2 in hub1.connectedHubs:
            hub1.connectedHubs.remove(uuid2)
        if uuid1 in hub2.connectedHubs:
            hub2.connectedHubs.remove(uuid1)

        hub1.removeRoutesFor(uuid2)
        hub2.removeRoutesFor(uuid1)

    def deleteRoomHub(self, uuid: UUID) -> None:
        hub = self.getRoomHubByUuid(uuid)

        if not hub:
            raise ValueError("Hub not found")

        for peerUuid in list(hub.connectedHubs):
            try:
                self.disconnectRoomHubs(uuid, peerUuid)
            except ValueError:
                continue

        for deviceUuid in list(hub.connectedDevices):
            device = self.getDeviceByUuid(deviceUuid)
            if device:
                device.hubUuid = None

        for otherHub in self.roomHubs:
            if otherHub.node.uuid != uuid:
                otherHub.removeRoutesFor(uuid)
                if uuid in otherHub.connectedHubs:
                    otherHub.connectedHubs.remove(uuid)

        self._removeConnectionsForNode(hub.node)

        if hub in self.roomHubs:
            self.roomHubs.remove(hub)
        if hub.node in self.nodes:
            self.nodes.remove(hub.node)

        hub.connectedDevices.clear()
        hub.connectedHubs.clear()
        hub.routeTable.clear()
        hub.onRouteFoundCallbacks.clear()

    def registerRoomHub(self, hub: "RoomHub") -> None:
        if hub not in self.roomHubs:
            self.roomHubs.append(hub)

    def registerDevice(self, device: "AIDevice") -> None:
        if device not in self.devices:
            self.devices.append(device)

    def getRoomHubs(self) -> List["RoomHub"]:
        return list(self.roomHubs)

    def getDevices(self) -> List["AIDevice"]:
        return list(self.devices)
