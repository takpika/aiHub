from typing import List
from uuid import UUID

from fastapi import FastAPI, HTTPException, Response, status

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


def createApp(manager: Manager) -> FastAPI:
    api = FastAPI()

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
        )

    @api.get("/hubs", response_model=List[RoomHubInfo])
    def listRoomHubs() -> List[RoomHubInfo]:
        return [toRoomHubInfo(hub) for hub in manager.getRoomHubs()]

    @api.post("/hubs", response_model=RoomHubInfo, status_code=status.HTTP_201_CREATED)
    def createRoomHub(payload: CreateRoomHubRequest) -> RoomHubInfo:
        hub = manager.createRoomHub(payload.name)
        return toRoomHubInfo(hub)

    @api.post("/hubs/{hubUuid}/connections", response_model=RoomHubInfo)
    def connectRoomHub(hubUuid: UUID, payload: HubConnectionRequest) -> RoomHubInfo:
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
    def disconnectRoomHub(hubUuid: UUID, peerUuid: UUID) -> RoomHubInfo:
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
    def deleteRoomHub(hubUuid: UUID) -> Response:
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
    def createDevice(payload: CreateDeviceRequest) -> DeviceInfo:
        if payload.hubUuid and not manager.getRoomHubByUuid(payload.hubUuid):
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

        if payload.hubUuid:
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
    def updateDeviceHub(deviceUuid: UUID, payload: UpdateDeviceHubRequest) -> DeviceInfo:
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
    def deleteDevice(deviceUuid: UUID) -> Response:
        try:
            manager.deleteDevice(deviceUuid)
        except ValueError as exc:
            message = str(exc)
            statusCode = status.HTTP_400_BAD_REQUEST
            if message == "Device not found":
                statusCode = status.HTTP_404_NOT_FOUND
            raise HTTPException(status_code=statusCode, detail=message)

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return api


app = createApp(defaultManager)
