import os

from typing import Any, List, Optional, Callable, TYPE_CHECKING, Tuple
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
        self._stateChangeListeners: List[Callable[[str, dict[str, Any]], None]] = []
        self._packetListeners: List[Callable[[UUID, UUID, ActionPacket], None]] = []

    def createNode(self, onPacketReceived: Optional[Callable[[ActionPacket], None]] = None) -> Node:
        node = Node(onPacketReceived=onPacketReceived, manager=self)
        self.nodes.append(node)
        return node

    def createConnection(self, node1: Node, node2: Node) -> Connection:
        connection = Connection(node1, node2, manager=self)
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

    def resolveNodeInfo(self, uuid: UUID) -> Tuple[Optional[str], Optional[str]]:
        """
        Return the display name and logical type for a node in the network.
        """
        device = self.getDeviceByUuid(uuid)
        if device:
            return device.name, "device"
        hub = self.getRoomHubByUuid(uuid)
        if hub:
            return hub.name, "hub"
        return None, None

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

        # Allow optional environment overrides for OpenAI client configuration.
        clientConfig = {}
        apiKey = os.getenv("OPENAI_API_KEY")
        if apiKey:
            clientConfig["api_key"] = apiKey

        baseUrl = os.getenv("OPENAI_BASE_URL")
        if baseUrl:
            clientConfig["base_url"] = baseUrl

        client = OpenAI(**clientConfig)
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

        if device.hubUuid is not None:
            try:
                device.leaveHub()
            except ValueError:
                pass

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

        self._removeConnectionsForNode(device.node)

        if device in self.devices:
            self.devices.remove(device)
        if device.node in self.nodes:
            self.nodes.remove(device.node)
        self._notifyStateChange("device.deleted", {"deviceUuid": str(uuid)})

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
        self._notifyStateChange(
            "hub.connection.created",
            {"sourceHubUuid": str(hub1.node.uuid), "targetHubUuid": str(hub2.node.uuid)},
        )

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
        self._notifyStateChange(
            "hub.connection.removed",
            {"sourceHubUuid": str(uuid1), "targetHubUuid": str(uuid2)},
        )

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
                self.onDeviceLeftHub(device, hub.node.uuid)
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
        self._notifyStateChange("hub.deleted", {"hubUuid": str(uuid)})

    def registerRoomHub(self, hub: "RoomHub") -> None:
        if hub not in self.roomHubs:
            self.roomHubs.append(hub)
            self._notifyStateChange("hub.created", {"hubUuid": str(hub.node.uuid)})

    def registerDevice(self, device: "AIDevice") -> None:
        if device not in self.devices:
            self.devices.append(device)
            self._notifyStateChange("device.created", {"deviceUuid": str(device.node.uuid)})

    def getRoomHubs(self) -> List["RoomHub"]:
        return list(self.roomHubs)

    def getDevices(self) -> List["AIDevice"]:
        return list(self.devices)

    def registerPacketTransferListener(
        self,
        listener: Callable[[UUID, UUID, ActionPacket], None],
    ) -> None:
        if listener not in self._packetListeners:
            self._packetListeners.append(listener)

    def unregisterPacketTransferListener(
        self,
        listener: Callable[[UUID, UUID, ActionPacket], None],
    ) -> None:
        if listener in self._packetListeners:
            self._packetListeners.remove(listener)

    def notifyPacketTransfer(self, source: Node, target: Node, packet: ActionPacket) -> None:
        packetCopy = packet.model_copy(deep=True)
        for listener in list(self._packetListeners):
            try:
                listener(source.uuid, target.uuid, packetCopy)
            except Exception:
                continue

    def registerStateChangeListener(self, listener: Callable[[str, dict[str, Any]], None]) -> None:
        if listener not in self._stateChangeListeners:
            self._stateChangeListeners.append(listener)

    def unregisterStateChangeListener(self, listener: Callable[[str, dict[str, Any]], None]) -> None:
        if listener in self._stateChangeListeners:
            self._stateChangeListeners.remove(listener)

    def onDeviceJoinedHub(self, device: "AIDevice", hubUuid: UUID) -> None:
        hub = self.getRoomHubByUuid(hubUuid)
        if not hub:
            return
        if device.node.uuid not in hub.connectedDevices:
            hub.connectedDevices.append(device.node.uuid)
        self._notifyStateChange(
            "device.moved",
            {"deviceUuid": str(device.node.uuid), "hubUuid": str(hubUuid)},
        )

    def onDeviceLeftHub(self, device: "AIDevice", hubUuid: Optional[UUID]) -> None:
        if not hubUuid:
            return
        hub = self.getRoomHubByUuid(hubUuid)
        if hub and device.node.uuid in hub.connectedDevices:
            hub.connectedDevices.remove(device.node.uuid)
        try:
            self.removeConnectionByUuids(device.node.uuid, hubUuid)
        except ValueError:
            pass
        self._notifyStateChange(
            "device.moved",
            {"deviceUuid": str(device.node.uuid), "hubUuid": None},
        )

    def onDeviceStreamingChanged(self, device: "AIDevice", isStreaming: bool) -> None:
        self._notifyStateChange(
            "device.streaming",
            {"deviceUuid": str(device.node.uuid), "isStreaming": isStreaming},
        )

    def _notifyStateChange(self, reason: str, changes: Optional[dict[str, Any]] = None) -> None:
        for listener in list(self._stateChangeListeners):
            try:
                listener(reason, dict(changes) if changes else {})
            except Exception:
                continue
