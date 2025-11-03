import json
from uuid import UUID
from typing import List, Optional, Callable
from datetime import datetime, timedelta

from pydantic import BaseModel

from app.network.manager import Manager
from app.models.action_packet import ActionPacket
from app.enums.action_type import ActionType
from app.network.devices.ai_device import AIDevice

class RouteTableItem(BaseModel):
    destination: UUID
    nextHop: UUID
    cost: int
    expires: datetime = datetime.now() + timedelta(seconds=3)

class RoomHub:
    def __init__(self, name: str, manager: Manager) -> None:
        self.name = name
        self.manager = manager
        self.node = self.manager.createNode(self.onPacketReceived)
        self.connectedHubs: List[UUID] = []
        self.connectedDevices: List[UUID] = []
        self.routeTable: List[RouteTableItem] = []
        self.onRouteFoundCallbacks: dict[UUID, Callable[[RouteTableItem], None]] = {}
        self.packetListeners: List[Callable[[ActionPacket], None]] = []
        self.manager.registerRoomHub(self)

    def lookupRoute(self, destination: UUID) -> Optional[RouteTableItem]:
        for hubUuid in self.connectedHubs:
            if hubUuid == destination:
                return RouteTableItem(
                    destination=destination,
                    nextHop=destination,
                    cost=1
                )
        for deviceUuid in self.connectedDevices:
            if deviceUuid == destination:
                return RouteTableItem(
                    destination=destination,
                    nextHop=destination,
                    cost=1
                )
        for item in self.routeTable:
            if item.destination == destination:
                if item.expires.timestamp() > datetime.now().timestamp():
                    return item
        return None

    def addRoute(self, destination: UUID, nextHop: UUID, cost: int) -> None:
        item = self.lookupRoute(destination)
        if item:
            if cost < item.cost:
                item.nextHop = nextHop
                item.cost = cost
                item.expires = datetime.now() + timedelta(seconds=3)
        else:
            self.routeTable.append(RouteTableItem(
                destination=destination,
                nextHop=nextHop,
                cost=cost
            ))

    def findRoute(self, destination: UUID, onFound: Callable[[RouteTableItem], None]) -> None:
        if destination == self.node.uuid:
            return
        route = self.lookupRoute(destination)
        if route:
            onFound(route)
        else:
            self.onRouteFoundCallbacks[destination] = onFound
            self.node.sendPacket(None, ActionPacket(
                type=ActionType.DISCOVERY_REQUEST,
                sender=self.node.uuid,
                recipient=destination,
                context=f"{self.node.uuid}",
            ))

    def registerPacketListener(self, listener: Callable[[ActionPacket], None]) -> None:
        if listener not in self.packetListeners:
            self.packetListeners.append(listener)

    def unregisterPacketListener(self, listener: Callable[[ActionPacket], None]) -> None:
        if listener in self.packetListeners:
            self.packetListeners.remove(listener)

    def _notifyPacketListeners(self, packet: ActionPacket) -> None:
        for listener in list(self.packetListeners):
            try:
                listener(packet.model_copy(deep=True))
            except Exception:
                continue

    def onPacketReceived(self, packet: ActionPacket) -> None:
        print(f"{self.name} received packet: {packet}")
        self._notifyPacketListeners(packet)
        if packet.type == ActionType.DISCOVERY_REQUEST:
            if packet.recipient is None:
                return
            route = self.lookupRoute(packet.recipient)
            try:
                lastHop = UUID(packet.context)
            except ValueError:
                return
            self.addRoute(packet.sender, lastHop, packet.originalTtl - packet.ttl)
            if route:
                self.node.sendPacket(lastHop, ActionPacket(
                    type=ActionType.DISCOVERY_RESPONSE,
                    sender=packet.recipient,
                    recipient=packet.sender,
                    context=f"{self.node.uuid}",
                    ttl=packet.originalTtl - route.cost
                ))
            else:
                packet.context = f"{self.node.uuid}"
                for hub in self.connectedHubs:
                    if hub != lastHop:
                        self.node.sendPacket(hub, packet)
        elif packet.type == ActionType.DISCOVERY_RESPONSE:
            if packet.recipient is None:
                return
            route = self.lookupRoute(packet.recipient)
            try:
                lastHop = UUID(packet.context)
            except ValueError:
                return
            self.addRoute(packet.sender, lastHop, packet.originalTtl - packet.ttl)
            if route:
                packet.context = f"{self.node.uuid}"
                self.node.sendPacket(route.nextHop, packet)
            if packet.sender in self.onRouteFoundCallbacks:
                self.onRouteFoundCallbacks[packet.sender](RouteTableItem(
                    destination=packet.sender,
                    nextHop=lastHop,
                    cost=packet.originalTtl - packet.ttl
                ))
                del self.onRouteFoundCallbacks[packet.sender]
        elif packet.type == ActionType.CONNECT_CHECK_REQUEST:
            if packet.recipient is None:
                return
            if packet.recipient in self.connectedDevices or packet.recipient in self.connectedHubs:
                self.node.sendPacket(packet.sender, ActionPacket(
                    type=ActionType.CONNECT_CHECK_RESPONSE,
                    sender=packet.recipient,
                    recipient=packet.sender,
                    context="OK"
                ))
            else:
                self.node.sendPacket(packet.sender, ActionPacket(
                    type=ActionType.CONNECT_CHECK_RESPONSE,
                    sender=packet.recipient,
                    recipient=packet.sender,
                    context="NOT_OK"
                ))
        elif packet.type == ActionType.CONNECT_CHECK_RESPONSE:
            return
        elif packet.type == ActionType.ADJACENT_HUBS_REQUEST:
            hubs: list[str] = [str(hub) for hub in self.connectedHubs]
            self.node.sendPacket(packet.sender, ActionPacket(
                type=ActionType.ADJACENT_HUBS_RESPONSE,
                sender=self.node.uuid,
                recipient=packet.sender,
                context=json.dumps({"hubs": hubs})
            ))
        elif packet.type == ActionType.ADJACENT_HUBS_RESPONSE:
            return
        elif packet.type == ActionType.HUB_NAME_REQUEST:
            self.node.sendPacket(packet.sender, ActionPacket(
                type=ActionType.HUB_NAME_RESPONSE,
                sender=self.node.uuid,
                recipient=packet.sender,
                context=self.name
            ))
        elif packet.type == ActionType.HUB_NAME_RESPONSE:
            return
        elif packet.type == ActionType.PING:
            if packet.recipient is None:
                for deviceUuid in self.connectedDevices:
                    self.node.sendPacket(deviceUuid, packet)
            else:
                if packet.recipient in self.connectedDevices:
                    self.node.sendPacket(packet.recipient, packet)
        elif packet.type == ActionType.TEXT:
            if packet.recipient is None:
                return
            self.findRoute(packet.recipient, lambda route: self.node.sendPacket(route.nextHop, packet))
            if packet.sender in self.connectedDevices:
                packetCopy = packet.model_copy(deep=True)
                packetCopy.recipient = None
                packetCopy.context = None
                for deviceUuid in self.connectedDevices:
                    if deviceUuid != packet.sender:
                        self.node.sendPacket(deviceUuid, packetCopy)
        else:
            if packet.sender not in self.connectedDevices:
                if packet.type == ActionType.JOIN:
                    self.connectedDevices.append(packet.sender)
                else:
                    return
            if packet.recipient is not None and packet.recipient in self.connectedDevices:
                self.node.sendPacket(packet.recipient, packet)
            packetCopy = packet.model_copy(deep=True)
            if packet.type == ActionType.WHISPER:
                packetCopy.context = None
            elif packet.type == ActionType.LEAVE:
                if packet.sender in self.connectedDevices:
                    self.connectedDevices.remove(packet.sender)
            for deviceUuid in self.connectedDevices:
                if deviceUuid != packet.sender and deviceUuid != packet.recipient:
                    self.node.sendPacket(deviceUuid, packetCopy)

    def isHubConnected(self, hubUuid: UUID) -> bool:
        return hubUuid in self.connectedHubs

    def connectHub(self, hub: "RoomHub") -> None:
        hubNode = hub.node
        if hubNode.uuid == self.node.uuid:
            raise ValueError("Hub cannot connect to itself")
        if hubNode.uuid in self.connectedHubs:
            return
        self.manager.createConnection(self.node, hubNode)
        self.connectedHubs.append(hubNode.uuid)
        if self.node.uuid not in hub.connectedHubs:
            hub.connectedHubs.append(self.node.uuid)

    def onConnectAI(self, ai: "AIDevice") -> None:
        aiNode = ai.node
        self.connectedDevices.append(aiNode.uuid)

    def removeRoutesFor(self, targetUuid: UUID) -> None:
        self.routeTable = [
            item
            for item in self.routeTable
            if item.destination != targetUuid and item.nextHop != targetUuid
        ]
        if targetUuid in self.onRouteFoundCallbacks:
            del self.onRouteFoundCallbacks[targetUuid]
