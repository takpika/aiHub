from enum import StrEnum, auto

class ActionType(StrEnum):
    TALK = auto()
    WHISPER = auto()
    TEXT = auto()
    POINT = auto()
    RAISE_HAND = auto()
    LEAVE = auto()
    JOIN = auto()
    DISCOVERY_REQUEST = auto()
    DISCOVERY_RESPONSE = auto()
    CONNECT_CHECK_REQUEST = auto()
    CONNECT_CHECK_RESPONSE = auto()
    ADJACENT_HUBS_REQUEST = auto()
    ADJACENT_HUBS_RESPONSE = auto()
    HUB_NAME_REQUEST = auto()
    HUB_NAME_RESPONSE = auto()
    PING = auto()
