import asyncio
from datetime import datetime
from typing import Any, List
from uuid import UUID

from pathlib import Path

from fastapi import FastAPI, HTTPException, Response, WebSocket, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect

from app.api.schemas import (
    RoomHubInfo,
    DeviceInfo,
    CreateRoomHubRequest,
    HubConnectionRequest,
    CreateDeviceRequest,
    UpdateDeviceHubRequest,
)
from app.state import manager as defaultManager
from app.network.manager import Manager
from app.network.devices.ai_device import AIDevice
from app.network.devices.room_hub import RoomHub
from app.models.action_packet import ActionPacket


class StateBroadcaster:
    def __init__(self) -> None:
        self._queues: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._queues.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            self._queues.discard(queue)

    async def broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            listeners = list(self._queues)
        for queue in listeners:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                continue


def createApp(manager: Manager) -> FastAPI:
    api = FastAPI()
    stateBroadcaster = StateBroadcaster()
    loopHolder: dict[str, asyncio.AbstractEventLoop | None] = {"loop": None}

    def toRoomHubInfo(hub: RoomHub) -> RoomHubInfo:
        return RoomHubInfo(
            uuid=hub.node.uuid,
            name=hub.name,
            connectedHubs=list(hub.connectedHubs),
            connectedDevices=list(hub.connectedDevices),
        )

    def toDeviceInfo(device: AIDevice) -> DeviceInfo:
        return DeviceInfo(
            uuid=device.node.uuid,
            name=device.name,
            hubUuid=device.hubUuid,
            privacyMode=device.privacyMode,
            model=device.model,
            isReasoning=device.isReasoning,
            debug=device.debug,
            coolTime=device.coolTime,
            timeOut=device.timeOut,
            situation=device.situation,
            runAI=getattr(device, "runAI", False),
            isStreaming=getattr(device, "isStreaming", False),
        )

    def snapshot_state() -> dict[str, Any]:
        return {
            "hubs": [toRoomHubInfo(hub).model_dump(mode="json") for hub in manager.getRoomHubs()],
            "devices": [
                toDeviceInfo(device).model_dump(mode="json") for device in manager.getDevices()
            ],
        }

    async def emit_state(reason: str, *, changes: dict[str, Any] | None = None) -> None:
        payload: dict[str, Any] = {
            "event": "state.update",
            "reason": reason,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }
        payload.update(snapshot_state())
        if changes:
            payload["changes"] = changes
        await stateBroadcaster.broadcast(payload)

    def schedule_state_emit(reason: str, changes: dict[str, Any] | None = None) -> None:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(emit_state(reason, changes=changes))
        except RuntimeError:
            loop = loopHolder["loop"]
            if loop:
                try:
                    asyncio.run_coroutine_threadsafe(
                        emit_state(reason, changes=changes),
                        loop,
                    )
                except RuntimeError:
                    pass

    async def emit_packet_transfer(message: dict[str, Any]) -> None:
        await stateBroadcaster.broadcast(message)

    def schedule_packet_transfer(sourceUuid: UUID, targetUuid: UUID, packet: ActionPacket) -> None:
        payload: dict[str, Any] = {
            "event": "packet.transfer",
            "sourceUuid": str(sourceUuid),
            "targetUuid": str(targetUuid),
            "packet": packet.model_dump(mode="json"),
            "sentAt": datetime.utcnow().isoformat() + "Z",
        }
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(emit_packet_transfer(payload))
        except RuntimeError:
            loop = loopHolder["loop"]
            if loop:
                try:
                    asyncio.run_coroutine_threadsafe(
                        emit_packet_transfer(payload),
                        loop,
                    )
                except RuntimeError:
                    pass

    def handle_manager_state_change(reason: str, changes: dict[str, Any]) -> None:
        schedule_state_emit(reason, changes)

    def handle_packet_transfer(sourceUuid: UUID, targetUuid: UUID, packet: ActionPacket) -> None:
        schedule_packet_transfer(sourceUuid, targetUuid, packet)

    manager.registerStateChangeListener(handle_manager_state_change)
    manager.registerPacketTransferListener(handle_packet_transfer)

    @api.on_event("startup")
    async def capture_event_loop() -> None:
        loopHolder["loop"] = asyncio.get_running_loop()

    @api.on_event("shutdown")
    async def release_event_loop() -> None:
        loopHolder["loop"] = None
        manager.unregisterStateChangeListener(handle_manager_state_change)
        manager.unregisterPacketTransferListener(handle_packet_transfer)

    @api.get("/hubs", response_model=List[RoomHubInfo])
    def listRoomHubs() -> List[RoomHubInfo]:
        return [toRoomHubInfo(hub) for hub in manager.getRoomHubs()]

    @api.post("/hubs", response_model=RoomHubInfo, status_code=status.HTTP_201_CREATED)
    async def createRoomHub(payload: CreateRoomHubRequest) -> RoomHubInfo:
        hub = manager.createRoomHub(payload.name)
        return toRoomHubInfo(hub)

    @api.post("/hubs/{hubUuid}/connections", response_model=RoomHubInfo)
    async def connectRoomHub(hubUuid: UUID, payload: HubConnectionRequest) -> RoomHubInfo:
        try:
            manager.connectRoomHubs(hubUuid, payload.targetHubUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Hub not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        hub = manager.getRoomHubByUuid(hubUuid)
        if not hub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hub not found")

        return toRoomHubInfo(hub)

    @api.delete("/hubs/{hubUuid}/connections/{peerUuid}", response_model=RoomHubInfo)
    async def disconnectRoomHub(hubUuid: UUID, peerUuid: UUID) -> RoomHubInfo:
        try:
            manager.disconnectRoomHubs(hubUuid, peerUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Hub not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        hub = manager.getRoomHubByUuid(hubUuid)
        if not hub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hub not found")

        return toRoomHubInfo(hub)

    @api.delete("/hubs/{hubUuid}", status_code=status.HTTP_204_NO_CONTENT)
    async def deleteRoomHub(hubUuid: UUID) -> Response:
        try:
            manager.deleteRoomHub(hubUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Hub not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @api.get("/devices", response_model=List[DeviceInfo])
    def listDevices() -> List[DeviceInfo]:
        return [toDeviceInfo(device) for device in manager.getDevices()]

    @api.post("/devices", response_model=DeviceInfo, status_code=status.HTTP_201_CREATED)
    async def createDevice(payload: CreateDeviceRequest) -> DeviceInfo:
        if not manager.getRoomHubByUuid(payload.hubUuid):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hub not found")

        try:
            device = manager.createAIDevice(
                name=payload.name,
                situation=payload.situation,
                runAI=payload.runAI,
                model=payload.model,
                isReasoning=payload.isReasoning,
                debug=payload.debug,
                coolTime=payload.coolTime,
                timeOut=payload.timeOut,
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        try:
            manager.setDeviceHub(device.node.uuid, payload.hubUuid)
        except ValueError as exc:
            try:
                manager.deleteDevice(device.node.uuid)
            except ValueError:
                pass
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Hub not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        return toDeviceInfo(device)

    @api.put("/devices/{deviceUuid}/hub", response_model=DeviceInfo)
    async def updateDeviceHub(deviceUuid: UUID, payload: UpdateDeviceHubRequest) -> DeviceInfo:
        try:
            manager.setDeviceHub(deviceUuid, payload.hubUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message in ("Device not found", "Hub not found"):
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        device = manager.getDeviceByUuid(deviceUuid)
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

        return toDeviceInfo(device)

    @api.delete("/devices/{deviceUuid}", status_code=status.HTTP_204_NO_CONTENT)
    async def deleteDevice(deviceUuid: UUID) -> Response:
        try:
            manager.deleteDevice(deviceUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Device not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    webRoot = Path(__file__).resolve().parent.parent.parent / "web"
    if webRoot.exists():
        api.mount("/web", StaticFiles(directory=webRoot, html=True), name="web")

        @api.get("/", include_in_schema=False)
        def serveIndex() -> FileResponse:
            return FileResponse(webRoot / "index.html")

    @api.websocket("/updates")
    async def streamStateUpdates(websocket: WebSocket) -> None:
        await websocket.accept()
        queue = await stateBroadcaster.subscribe()
        keepalive_timeout = 30.0
        try:
            initialPayload: dict[str, Any] = {
                "event": "state.init",
                "updatedAt": datetime.utcnow().isoformat() + "Z",
            }
            initialPayload.update(snapshot_state())
            await websocket.send_json(initialPayload)
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=keepalive_timeout)
                    await websocket.send_json(message)
                except asyncio.TimeoutError:
                    await websocket.send_json({"event": "keepalive"})
        except WebSocketDisconnect:
            pass
        finally:
            await stateBroadcaster.unsubscribe(queue)

    @api.websocket("/hubs/{hubUuid}/packets")
    async def streamHubPackets(websocket: WebSocket, hubUuid: UUID) -> None:
        hub = manager.getRoomHubByUuid(hubUuid)
        await websocket.accept()
        if not hub:
            await websocket.send_json({"error": "Hub not found"})
            await websocket.close(code=4404)
            return

        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict] = asyncio.Queue()

        def listener(packet: ActionPacket) -> None:
            event = {
                "hubUuid": str(hubUuid),
                "receivedAt": datetime.utcnow().isoformat() + "Z",
                # Use JSON mode to convert UUIDs and enums into serialisable primitives
                "packet": packet.model_dump(mode="json"),
            }
            loop.call_soon_threadsafe(queue.put_nowait, event)

        hub.registerPacketListener(listener)
        keepalive_timeout = 30.0
        try:
            await websocket.send_json({"event": "ready"})
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=keepalive_timeout)
                    await websocket.send_json(payload)
                except asyncio.TimeoutError:
                    await websocket.send_json({"event": "keepalive"})
        except WebSocketDisconnect:
            pass
        finally:
            hub.unregisterPacketListener(listener)

    @api.websocket("/devices/{deviceUuid}/events")
    async def streamDeviceEvents(websocket: WebSocket, deviceUuid: UUID) -> None:
        device = manager.getDeviceByUuid(deviceUuid)
        await websocket.accept()
        if not device:
            await websocket.send_json({"error": "Device not found"})
            await websocket.close(code=4404)
            return

        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        def listener(event: dict[str, Any]) -> None:
            payload = dict(event)
            payload.setdefault("receivedAt", datetime.utcnow().isoformat() + "Z")
            loop.call_soon_threadsafe(queue.put_nowait, payload)

        device.registerEventListener(listener)
        keepalive_timeout = 30.0
        try:
            await websocket.send_json({"event": "ready"})
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=keepalive_timeout)
                    await websocket.send_json(payload)
                except asyncio.TimeoutError:
                    await websocket.send_json({"event": "keepalive"})
        except WebSocketDisconnect:
            pass
        finally:
            device.unregisterEventListener(listener)

    return api


app = createApp(defaultManager)
