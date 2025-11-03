import os
import json
import threading
import traceback
from datetime import datetime
from uuid import UUID
from typing import Any, Dict, Iterable, List, Optional, Callable, TYPE_CHECKING
from time import time, sleep

from openai import OpenAI, Stream
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, ChatCompletionMessageToolCallParam, ChatCompletionToolParam, ChatCompletionChunk, ChatCompletionToolMessageParam
from openai.types.chat.chat_completion_message_tool_call_param import Function
from openai.types.shared_params import FunctionDefinition

from app.network.manager import Manager
from app.models.action_packet import ActionPacket
from app.enums.action_type import ActionType

if TYPE_CHECKING:
    from app.network.devices.room_hub import RoomHub

class TimestampedMessage:
    def __init__(self, message: ChatCompletionMessageParam, timestamp: float, isSystemMessage: bool = False):
        self.message = message
        self.timestamp = timestamp
        self.isSystemMessage = isSystemMessage

class AIDevice:
    def __init__(self, name: str, manager: Manager, client: OpenAI, situation: str = "", runAI: bool = True, model: str = "gpt-4o", isReasoning: bool = False, debug: bool = False, coolTime: float = 0.2, timeOut: float = 10) -> None:
        self.name = name
        self.manager = manager
        self.node = self.manager.createNode(self.onPacketReceived)
        self.client = client
        self.situation = situation
        self.model = model
        self.isReasoning = isReasoning
        self.debug = debug
        self.coolTime = coolTime
        self.timeOut = timeOut
        self.runAI = runAI
        self.cachePackets: List[ActionPacket] = []
        self.hubUuid: Optional[UUID] = None
        self.isStreaming = False

        self.wellKnownNames: dict[str, UUID] = {}
        self.connectionCallbacks: dict[UUID, Callable[[ActionPacket], None]] = {}
        self._eventListeners: List[Callable[[dict[str, Any]], None]] = []
        self._eventListenersLock = threading.Lock()
        self.moveHubRequestResult: Optional[bool] = None
        self.privacyMode = False
        self.manager.registerDevice(self)
        if runAI:
            threading.Thread(target=self.run, daemon=True).start()

    def registerEventListener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        addedListener = False
        with self._eventListenersLock:
            if listener not in self._eventListeners:
                self._eventListeners.append(listener)
                addedListener = True
        if addedListener:
            self._emitContactsDirectory()

    def unregisterEventListener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        with self._eventListenersLock:
            if listener in self._eventListeners:
                self._eventListeners.remove(listener)

    def _emitEvent(self, eventType: str, payload: Dict[str, Any]) -> None:
        event: Dict[str, Any] = {
            "type": eventType,
            "deviceUuid": str(self.node.uuid),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        event.update(payload)
        with self._eventListenersLock:
            listeners = list(self._eventListeners)
        for listener in listeners:
            try:
                listener(event)
            except Exception:
                if self.debug:
                    print(traceback.format_exc())

    def _serializeReasoning(self, reasoning: Any) -> Any:
        if reasoning is None:
            return None
        if hasattr(reasoning, "model_dump"):
            try:
                return reasoning.model_dump(mode="json")
            except TypeError:
                return reasoning.model_dump()
        if isinstance(reasoning, list):
            serialized = []
            for item in reasoning:
                if hasattr(item, "model_dump"):
                    try:
                        serialized.append(item.model_dump(mode="json"))
                    except TypeError:
                        serialized.append(item.model_dump())
                else:
                    serialized.append(item)
            return serialized
        return reasoning

    def _buildContactsDirectoryEntries(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        for name, uuid in sorted(self.wellKnownNames.items(), key=lambda item: str(item[0]).lower()):
            displayName, entityType = self.manager.resolveNodeInfo(uuid)
            if uuid == self.node.uuid:
                displayName = self.name
                entityType = "device"
            entry: Dict[str, Any] = {
                "alias": name,
                "uuid": str(uuid),
                "displayName": displayName,
                "kind": entityType or "unknown",
            }
            entries.append(entry)
        return entries

    def _emitContactsDirectory(self) -> None:
        entries = self._buildContactsDirectoryEntries()
        self._emitEvent("contacts.directory", {"entries": entries})

    def _setStreaming(self, isStreaming: bool) -> None:
        if self.isStreaming == isStreaming:
            return
        self.isStreaming = isStreaming
        try:
            self.manager.onDeviceStreamingChanged(self, isStreaming)
        except AttributeError:
            pass

    def run(self) -> None:
        messages: List[TimestampedMessage] = [
            TimestampedMessage(self.generateSystemPrompt(), time(), isSystemMessage=True)
        ]
        skipCheck = False
        needsThinking = False
        needsCallFunction = False
        lastTriedFunctions = False
        while True:
            currentTime = time()
            # Check if any non-excluded message is older than 2 hours
            if any(currentTime - msg.timestamp >= 7200 and not msg.isSystemMessage for msg in messages):
                removedMessages = []
                newMessages = []
                for msg in messages:
                    if msg.isSystemMessage or currentTime - msg.timestamp < 3600:
                        newMessages.append(msg)
                    else:
                        removedMessages.append(msg)
                messages = newMessages
                # Process removed messages here
                # For example, log them or handle them as needed

            checkStartTime = currentTime
            while len(self.cachePackets) == 0 and not skipCheck:
                if time() - checkStartTime > self.timeOut:
                    break
                sleep(0.1)
            userMessage = ""
            for packet in self.cachePackets:
                sender: UUID | str = packet.sender
                recipient: Optional[UUID | str] = packet.recipient
                senderName = self.findNameFromUuid(sender)
                if senderName:
                    sender = senderName
                else:
                    sender = f"Unknown ({sender})"
                recipientName = self.findNameFromUuid(recipient) if recipient else None
                if recipientName:
                    recipient = recipientName
                if packet.type == ActionType.TALK:
                    if recipient:
                        userMessage += f"TALK: {sender} -> You: {packet.context}\n"
                    else:
                        userMessage += f"TALK: {sender} -> Everyone: {packet.context}\n"
                elif packet.type == ActionType.ADJACENT_HUBS_RESPONSE:
                    userMessage += f"ASYNC: Response arrived. Adjacent rooms: {json.loads(packet.context)['hubs']}\n"
                elif packet.type == ActionType.HUB_NAME_RESPONSE:
                    userMessage += f"ASYNC: Response arrived. Current room name: {packet.context}\n"
                if not self.privacyMode or (self.privacyMode and packet.recipient == self.node.uuid):
                    if packet.type == ActionType.WHISPER:
                        if recipient:
                            userMessage += f"WHISPER: {sender} -> You: {packet.context}\n"
                        else:
                            userMessage += f"WHISPER: {sender} is whispering to someone\n"
                    if packet.type == ActionType.TEXT:
                        if recipient:
                            userMessage += f"TEXT: {sender} -> You: {packet.context}\n"
                        else:
                            userMessage += f"TEXT: {sender} is sending a message to someone\n"
                if not self.privacyMode:
                    if packet.type == ActionType.POINT:
                        userMessage += f"POINT: {sender} -> {recipient}\n"
                    elif packet.type == ActionType.RAISE_HAND:
                        userMessage += f"RAISE_HAND: {sender} raised their hand\n"
                    elif packet.type == ActionType.PING:
                        if packet.recipient:
                            userMessage += f"PING: Ping response arrived from {sender}\n"
                            print(f"PONG: {sender} -> {recipient}")
                        else:
                            if packet.sender != self.node.uuid:
                                userMessage += f"PING: {sender} pinged everyone\n"
                    elif packet.type == ActionType.JOIN:
                        userMessage += f"JOIN: {sender} joined the room\n"
                    elif packet.type == ActionType.LEAVE:
                        userMessage += f"LEAVE: {sender} left the room\n"
            if self.moveHubRequestResult is not None:
                if not self.moveHubRequestResult:
                    userMessage += "ASYNC: Request failed. The target room is not adjacent to the current room\n"
            if len(self.cachePackets) == 0 and not skipCheck:
                userMessage += "NOTIFY: Nothing happened for a while.\nIt's up to you whether you take action or not.\n"
            self.cachePackets.clear()
            skipCheck = False
            if userMessage != "":
                needsThinking = True
                lastTriedFunctions = False
                needsCallFunction = False
                self._emitEvent("user.message", {
                    "message": {
                        "role": "user",
                        "content": userMessage
                    }
                })
                messages.append(TimestampedMessage(ChatCompletionUserMessageParam(
                    content=userMessage,
                    role="user"
                ), time()))
            else:
                if needsCallFunction:
                    messages.append(TimestampedMessage(ChatCompletionUserMessageParam(
                        content="SYSTEM: You can call functions now",
                        role="user"
                    ), time()))
            try:
                completion: Stream[ChatCompletionChunk] = self.client.chat.completions.create(
                    model=self.model,
                    messages=[msg.message for msg in messages],
                    tools=self.getTools(),
                    tool_choice="auto",
                    stream=True
                )
            except Exception as e:
                print(json.dumps([msg.message for msg in messages], ensure_ascii=False))
                raise e
            messageCache: Optional[str] = None
            functionId: Optional[str] = None
            functionNameCache = ""
            functionArgumentsStringCache = ""
            functionsCache: dict[str, tuple[str, str]] = {}
            completionStartTime = time()
            responseId: Optional[str] = None
            responseCreated: Optional[int] = None
            finishReason: Optional[str] = None
            streamInterrupted = False
            self._setStreaming(True)
            try:
                for chunk in completion:
                    if self.debug:
                        print(chunk)
                    choice = chunk.choices[0]
                    delta = choice.delta
                    if responseId is None and getattr(chunk, "id", None) is not None:
                        responseId = chunk.id
                    if responseCreated is None and getattr(chunk, "created", None) is not None:
                        responseCreated = chunk.created
                    jsonParseResult = True
                    try:
                        if functionId is not None:
                            json.loads(functionArgumentsStringCache)
                    except json.JSONDecodeError:
                        jsonParseResult = False
                    if len(self.cachePackets) > 0 and time() - completionStartTime > self.coolTime and jsonParseResult:
                        streamInterrupted = True
                        break
                    if choice.finish_reason is not None:
                        finishReason = choice.finish_reason
                        if choice.finish_reason != "stop":
                            skipCheck = True
                    deltaPayload: Dict[str, Any] = {}
                    if delta.role is not None:
                        deltaPayload["role"] = delta.role
                    if delta.content is not None:
                        if messageCache is None:
                            messageCache = ""
                        messageCache += delta.content
                        deltaPayload["content"] = delta.content
                    reasoningPayload = getattr(delta, "reasoning", None)
                    if reasoningPayload is not None:
                        serializedReasoning = self._serializeReasoning(reasoningPayload)
                        deltaPayload["reasoning"] = serializedReasoning
                    if delta.tool_calls is not None:
                        toolCall = delta.tool_calls[0]
                        if toolCall.id is not None and functionId != toolCall.id:
                            if functionId is not None:
                                functionsCache[functionId] = (functionNameCache, functionArgumentsStringCache)
                            functionId = toolCall.id
                            functionNameCache = ""
                            functionArgumentsStringCache = ""
                        if toolCall.function.name is not None:
                            functionNameCache += toolCall.function.name
                        if toolCall.function.arguments is not None:
                            functionArgumentsStringCache += toolCall.function.arguments
                    if deltaPayload:
                        eventPayload: Dict[str, Any] = {
                            "delta": deltaPayload,
                            "index": choice.index,
                            "responseId": responseId,
                        }
                        if responseCreated is not None:
                            eventPayload["created"] = responseCreated
                        if chunk.model is not None:
                            eventPayload["model"] = chunk.model
                        if finishReason is not None:
                            eventPayload["finishReason"] = finishReason
                        self._emitEvent("assistant.delta", eventPayload)
            finally:
                self._setStreaming(False)
            completion.close()
            if streamInterrupted:
                self._emitEvent("assistant.interrupted", {
                    "reason": "new_input",
                    "responseId": responseId
                })
            if functionId is not None:
                functionsCache[functionId] = (functionNameCache, functionArgumentsStringCache)
            assistant = ChatCompletionAssistantMessageParam(
                role="assistant"
            )
            if messageCache is not None:
                if len(messageCache) == 0:
                    messageCache = None
            if messageCache is not None:
                if self.debug: print(self.name, messageCache)
                assistant["content"] = messageCache
                needsThinking = False
                if lastTriedFunctions:
                    lastTriedFunctions = False
                    needsCallFunction = True
                self._emitEvent("assistant.message", {
                    "message": {
                        "role": "assistant",
                        "content": messageCache
                    },
                    "responseId": responseId,
                    "finishReason": finishReason
                })
            if self.isReasoning:
                needsThinking = False
            functionCallInputs: dict[str, tuple[str, str, bool, Any]] = {}
            if len(functionsCache) > 0:
                assistant["tool_calls"] = [ChatCompletionMessageToolCallParam(
                    id=toolCallId,
                    function=Function(
                        name=functionName,
                        arguments=functionArguments
                    ),
                    type="function"
                ) for toolCallId, (functionName, functionArguments) in functionsCache.items()]
                for toolCallId, (functionName, functionArguments) in functionsCache.items():
                    parsedArgs: Any = None
                    parsedOk = False
                    try:
                        parsedArgs = json.loads(functionArguments)
                        parsedOk = True
                    except json.JSONDecodeError:
                        pass
                    functionCallInputs[toolCallId] = (functionName, functionArguments, parsedOk, parsedArgs)
                    self._emitEvent("assistant.tool_call", {
                        "toolCallId": toolCallId,
                        "name": functionName,
                        "arguments": parsedArgs if parsedOk else functionArguments,
                        "argumentsIsJson": parsedOk,
                        "responseId": responseId
                    })
                skipCheck = True
                needsCallFunction = False
            elif messageCache is None:
                assistant["content"] = ""
                self._emitEvent("assistant.message", {
                    "message": {
                        "role": "assistant",
                        "content": ""
                    },
                    "responseId": responseId,
                    "finishReason": finishReason
                })
            if needsCallFunction and len(functionsCache) == 0:
                skipCheck = True
            messages.append(TimestampedMessage(assistant, time()))
            for functionId, (functionName, functionArgumentsString, parsedOk, parsedArgs) in functionCallInputs.items():
                if needsThinking:
                    errorPayload = {"message": "error: Write down the reasons for your actions before you act. Then, please try again."}
                    messages.append(TimestampedMessage(ChatCompletionToolMessageParam(
                        content=json.dumps(errorPayload),
                        role="tool",
                        tool_call_id=functionId
                    ), time()))
                    self._emitEvent("tool.result", {
                        "toolCallId": functionId,
                        "name": functionName,
                        "result": errorPayload
                    })
                    lastTriedFunctions = True
                    continue
                if not parsedOk:
                    errorPayload = {"message": "error: Invalid JSON"}
                    messages.append(TimestampedMessage(ChatCompletionToolMessageParam(
                        content=json.dumps(errorPayload),
                        role="tool",
                        tool_call_id=functionId
                    ), time()))
                    self._emitEvent("tool.result", {
                        "toolCallId": functionId,
                        "name": functionName,
                        "result": errorPayload
                    })
                    continue
                arguments = parsedArgs
                replyMessage = json.dumps({"message": "success"})
                try:
                    if functionName == "talk":
                        target: Optional[str] = arguments.get("target")
                        context: str = arguments.get("context")
                        if target:
                            targetUuid = self.getNameUuid(target)
                            if targetUuid or target.lower() == "everyone":
                                self.sendPacket(ActionPacket(
                                    type=ActionType.TALK,
                                    sender=self.node.uuid,
                                    recipient=targetUuid,
                                    context=context
                                ))
                            else:
                                replyMessage = json.dumps({"message": f"error: Target {target} not found"})
                        else:
                            self.sendPacket(ActionPacket(
                                type=ActionType.TALK,
                                sender=self.node.uuid,
                                context=context
                            ))
                    elif functionName == "whisper":
                        target: str = arguments.get("target")
                        context: str = arguments.get("context")
                        targetUuid = self.getNameUuid(target)
                        if targetUuid:
                            self.sendPacket(ActionPacket(
                                type=ActionType.WHISPER,
                                sender=self.node.uuid,
                                recipient=targetUuid,
                                context=context
                            ))
                        else:
                            replyMessage = json.dumps({"message": f"error: Target {target} not found"})
                    elif functionName == "text":
                        target: str = arguments.get("target")
                        context: str = arguments.get("context")
                        targetUuid = self.getNameUuid(target)
                        if targetUuid:
                            self.sendPacket(ActionPacket(
                                type=ActionType.TEXT,
                                sender=self.node.uuid,
                                recipient=targetUuid,
                                context=context
                            ))
                        else:
                            replyMessage = json.dumps({"message": f"error: Target {target} not found"})
                    elif functionName == "point":
                        target: str = arguments.get("target")
                        targetUuid = self.getNameUuid(target)
                        if targetUuid:
                            self.sendPacket(ActionPacket(
                                type=ActionType.POINT,
                                sender=self.node.uuid,
                                recipient=targetUuid
                            ))
                        else:
                            replyMessage = json.dumps({"message": f"error: Target {target} not found"})
                    elif functionName == "raiseHand":
                        self.sendPacket(ActionPacket(
                            type=ActionType.RAISE_HAND,
                            sender=self.node.uuid
                        ))
                    elif functionName == "registerContact":
                        name: str = arguments.get("name")
                        uuid: str = arguments.get("uuid")
                        try:
                            uuid = UUID(uuid)
                        except ValueError:
                            replyMessage = json.dumps({"message": f"error: Invalid UUID {uuid}"})
                            continue
                        if not self.registerName(name, uuid):
                            replyMessage = json.dumps({"message": f"error: Name {name} already exists"})
                    elif functionName == "getAdjacentRooms":
                        if not self.hubUuid:
                            replyMessage = json.dumps({"message": "error: You don't seem to be in any room"})
                            continue
                        self.sendPacket(ActionPacket(
                            type=ActionType.ADJACENT_HUBS_REQUEST,
                            sender=self.node.uuid
                        ))
                        replyMessage = json.dumps({"message": "ASYNC: Request sent. Please wait for the response"})
                    elif functionName == "moveToRoom":
                        roomUuid: str = arguments.get("roomUuid")
                        try:
                            roomUuid = UUID(roomUuid)
                        except ValueError:
                            replyMessage = json.dumps({"message": f"error: Invalid UUID {roomUuid}"})
                            continue
                        if not self.hubUuid:
                            replyMessage = json.dumps({"message": "error: You don't seem to be in any room"})
                            continue
                        self.moveHub(roomUuid)
                        replyMessage = json.dumps({"message": "ASYNC: Request sent. Please wait for the response"})
                    elif functionName == "getCurrentRoomName":
                        if not self.hubUuid:
                            replyMessage = json.dumps({"message": "error: You don't seem to be in any room"})
                            continue
                        self.sendPacket(ActionPacket(
                            type=ActionType.HUB_NAME_REQUEST,
                            sender=self.node.uuid,
                            recipient=self.hubUuid
                        ))
                        replyMessage = json.dumps({"message": "ASYNC: Request sent. Please wait for the response"})
                    elif functionName == "ping":
                        self.sendPacket(ActionPacket(
                            type=ActionType.PING,
                            sender=self.node.uuid
                        ))
                        replyMessage = json.dumps({"message": "PING: pinged everyone in the room. Please wait for the response"})
                except Exception as e:
                    replyMessage = json.dumps({"message": "error: Opps! Something went wrong"})
                    print(traceback.format_exc())
                messages.append(TimestampedMessage(ChatCompletionToolMessageParam(
                    content=replyMessage,
                    role="tool",
                    tool_call_id=functionId
                ), time()))
                try:
                    resultPayload = json.loads(replyMessage)
                except json.JSONDecodeError:
                    resultPayload = replyMessage
                self._emitEvent("tool.result", {
                    "toolCallId": functionId,
                    "name": functionName,
                    "result": resultPayload
                })

    def generateSystemPrompt(self) -> ChatCompletionSystemMessageParam:
        content = f"""
        You are the mind of the protagonist {self.name} in a story. Your role is to think deeply, analyze situations, and guide {self.name} step by step. Think deeply about the reasons for what you should do given the current situation.

        Your thoughts and reasoning should be in English, but you can communicate in English when using functions like talk. Always organize information, make predictions, and propose specific actions {self.name} should take. Before using any function, plan your actions step by step and explain why each step is important.

        You cannot decide unconfirmed events on your own, but you can speculate and build hypotheses. All information comes from the system, your only source of reality. Stay focused, trust your ability to think deeply, and remember—clear, calm reasoning will always lead to the best outcomes!

        Avoid using functions without a clear reason. Always think before you act. If you need to use a function, explain why you need to use it. If you need to talk to someone, explain why you need to talk to them. If you need to move to another room, explain why you need to move there.
        Avoid looping conversations. Always provide new information or ask questions to keep the conversation going. If you need to repeat information, explain why you need to repeat it.
        """
        return ChatCompletionSystemMessageParam(
            content=content,
            role="system"
        )

    def getTools(self) -> Iterable[ChatCompletionToolParam]:
        return [
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="talk",
                    description="Talk to someone. Everyone can hear you",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "Target to talk to. If not specified, the target will be everyone. UUID or name can be used"
                            },
                            "context": {
                                "type": "string",
                                "description": "Context of the conversation"
                            }
                        },
                        "required": [
                            "context"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="whisper",
                    description="Whisper to someone. Only the target can hear the content, but everyone can see who is whispering to whom",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "The target person to whisper to. This field is required. UUID or name can be used"
                            },
                            "context": {
                                "type": "string",
                                "description": "The message content to whisper"
                            }
                        },
                        "required": [
                            "target",
                            "context"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="text",
                    description="Send a text message. Everyone can see that you are sending a message, but the recipient and the content are hidden. You can also send messages to people who are not in the same room",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "The target person to send the text to. This field is required"
                            },
                            "context": {
                                "type": "string",
                                "description": "The content of the text message. This field is required"
                            }
                        },
                        "required": [
                            "target",
                            "context"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="point",
                    description="Point at someone. Everyone can see who is being pointed at",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "The target person to whisper to. This field is required. UUID or name can be used"
                            }
                        },
                        "required": [
                            "target"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="raiseHand",
                    description="Raise your hand. Everyone can see that you raised your hand",
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="registerContact",
                    description="Replace the displayed UUID of a contact with a custom name. Once registered, the custom name will be displayed instead of the UUID. To avoid confusion, it is recommended to ask the contact for their preferred name before registration",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "The custom name to replace and display instead of the UUID. It is recommended to use the name provided by the contact to avoid confusion. This field is required"
                            },
                            "uuid": {
                                "type": "string",
                                "description": "The UUID of the person to register"
                            }
                        },
                        "required": [
                            "name",
                            "uuid"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="getAdjacentRooms",
                    description="Retrieve the UUIDs of rooms adjacent to the current room. No parameters are required as the command uses the current room context",
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="moveToRoom",
                    description="Move to a specific room by providing its UUID. The UUID must correspond to an adjacent room",
                    parameters= {
                        "type": "object",
                        "properties": {
                            "roomUuid": {
                                "type": "string",
                                "description": "The UUID of the room to move to. Must be one of the adjacent room UUIDs"
                            }
                        },
                        "required": [
                            "roomUuid"
                        ]
                    }
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="getCurrentRoomName",
                    description="Retrieve the name of the room you are currently in",
                ),
                type="function"
            ),
            ChatCompletionToolParam(
                function=FunctionDefinition(
                    name="ping",
                    description="Send a ping to everyone in the same room. This allows you to check who is currently in the room",
                ),
                type="function"
            ),
        ]

    def getNameUuid(self, text: str) -> Optional[UUID]:
        try:
            return UUID(text)
        except ValueError:
            return self.findUuidFromName(text)

    def registerName(self, name: str, uuid: UUID) -> bool:
        if name in self.wellKnownNames:
            return False
        currentName = self.findNameFromUuid(uuid)
        if currentName:
            del self.wellKnownNames[currentName]
        self.wellKnownNames[name] = uuid
        self._emitContactsDirectory()
        return True

    def findUuidFromName(self, name: str) -> Optional[UUID]:
        return self.wellKnownNames.get(name)

    def findNameFromUuid(self, uuid: UUID) -> Optional[str]:
        if uuid == self.node.uuid:
            return "You"
        for name, _uuid in self.wellKnownNames.items():
            if _uuid == uuid:
                return name
        return None

    def onPacketReceived(self, packet: ActionPacket) -> None:
        if packet.type == ActionType.PING and packet.recipient is None and packet.sender != self.node.uuid:
            self.sendPacket(ActionPacket(
                type=ActionType.PING,
                sender=self.node.uuid,
                recipient=packet.sender
            ))
        if packet.type == ActionType.CONNECT_CHECK_RESPONSE:
            if packet.sender in self.connectionCallbacks:
                self.connectionCallbacks[packet.sender](packet)
                del self.connectionCallbacks[packet.sender]
            return
        self.cachePackets.append(packet)

    def sendPacket(self, packet: ActionPacket) -> None:
        if not self.hubUuid:
            raise ValueError("AI device is not connected to a hub")
        self.node.sendPacket(self.hubUuid, packet)

    def joinHub(self, hubUuid: UUID) -> None:
        if self.hubUuid:
            raise ValueError("AI device is already connected to a hub")
        self.manager.createConnectionByUuids(self.node.uuid, hubUuid)
        self.hubUuid = hubUuid
        packet = ActionPacket(
            type=ActionType.JOIN,
            sender=self.node.uuid,
            context=f"{hubUuid}"
        )
        self.sendPacket(packet)
        self.cachePackets.append(packet)
        try:
            self.manager.onDeviceJoinedHub(self, hubUuid)
        except AttributeError:
            # Backwards compatibility if manager has not been updated.
            pass

    def leaveHub(self) -> None:
        if not self.hubUuid:
            raise ValueError("AI device is not connected to a hub")
        currentHubUuid = self.hubUuid
        packet = ActionPacket(
            type=ActionType.LEAVE,
            sender=self.node.uuid,
            context=f"{self.hubUuid}"
        )
        self.sendPacket(packet)
        self.cachePackets.append(packet)
        self.hubUuid = None
        try:
            self.manager.onDeviceLeftHub(self, currentHubUuid)
        except AttributeError:
            pass

    def moveHub(self, newHubUuid: UUID) -> None:
        if not self.hubUuid:
            raise ValueError("AI device is not connected to a hub")
        self.moveHubRequestResult = None
        def onReply(packet: ActionPacket) -> None:
            if packet.context == "NOT_OK":
                self.moveHubRequestResult = False
                return
            self.moveHubRequestResult = True
            self.leaveHub()
            self.joinHub(newHubUuid)
        self.connectionCallbacks[newHubUuid] = onReply
        packet = ActionPacket(
            type=ActionType.CONNECT_CHECK_REQUEST,
            sender=self.node.uuid,
            recipient=newHubUuid
        )
        self.sendPacket(packet)
