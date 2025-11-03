const canvas = document.getElementById("networkCanvas");
const ctx = canvas.getContext("2d");
const apiInput = document.getElementById("apiEndpoint");
const refreshButton = document.getElementById("refreshButton");
const statusIndicator = document.getElementById("statusIndicator");
const tooltip = document.getElementById("tooltip");
const detailsPanel = document.getElementById("detailsPanel");
const detailsTitle = document.getElementById("detailsTitle");
const detailsId = document.getElementById("detailsId");
const detailsType = document.getElementById("detailsType");
const detailsHubRow = document.getElementById("detailsHubRow");
const detailsHub = document.getElementById("detailsHub");
const detailsConnectionsRow = document.getElementById("detailsConnectionsRow");
const detailsConnections = document.getElementById("detailsConnections");
const closeDetailsButton = document.getElementById("closeDetailsButton");
const deleteHubButton = document.getElementById("deleteHubButton");
const detailsActions = document.getElementById("detailsActions");
const infoPanel = document.getElementById("infoPanel");
const packetStreamSection = document.getElementById("packetStreamSection");
const packetMessages = document.getElementById("packetMessages");
const packetStreamStatus = document.getElementById("packetStreamStatus");
const deviceChatSection = document.getElementById("deviceChatSection");
const deviceChatMessages = document.getElementById("deviceChatMessages");
const deviceChatStatus = document.getElementById("deviceChatStatus");
const deviceChatTabChat = document.getElementById("deviceChatTabChat");
const deviceChatTabDirectory = document.getElementById("deviceChatTabDirectory");
const deviceNameDirectory = document.getElementById("deviceNameDirectory");
const connectionsSection = document.getElementById("connectionsSection");
const addConnectionButton = document.getElementById("addConnectionButton");
const connectionsList = document.getElementById("connectionsList");
const connectionPicker = document.getElementById("connectionPicker");
const connectionOptions = document.getElementById("connectionOptions");
const closePickerButton = document.getElementById("closePickerButton");
const createHubForm = document.getElementById("createHubForm");
const hubNameInput = document.getElementById("hubNameInput");
const createHubButton = document.getElementById("createHubButton");
const createAgentForm = document.getElementById("createAgentForm");
const agentNameInput = document.getElementById("agentNameInput");
const createAgentButton = document.getElementById("createAgentButton");
const agentModelInput = document.getElementById("agentModelInput");
const agentSituationInput = document.getElementById("agentSituationInput");
const agentRunAICheckbox = document.getElementById("agentRunAICheckbox");
const agentReasoningCheckbox = document.getElementById("agentReasoningCheckbox");
const agentDebugCheckbox = document.getElementById("agentDebugCheckbox");
const agentCoolTimeInput = document.getElementById("agentCoolTimeInput");
const agentTimeoutInput = document.getElementById("agentTimeoutInput");
const openCreateHubButton = document.getElementById("openCreateHubButton");
const openCreateAgentButton = document.getElementById("openCreateAgentButton");
const closeDrawerButton = document.getElementById("closeDrawerButton");
const closeAgentDrawerButton = document.getElementById("closeAgentDrawerButton");
const hubDrawer = document.getElementById("hubDrawer");
const agentDrawer = document.getElementById("agentDrawer");
const agentHubSelect = document.getElementById("agentHubSelect");
const deviceHubEditor = document.getElementById("deviceHubEditor");
const deviceHubCurrent = document.getElementById("deviceHubCurrent");
const deviceHubSelect = document.getElementById("deviceHubSelect");
const deviceHubSaveButton = document.getElementById("deviceHubSaveButton");
const drawerBackdrop = document.getElementById("drawerBackdrop");

const HUB_TYPE = "hub";
const DEVICE_TYPE = "device";
const HUB_EDGE_LENGTH = 240;
const DEVICE_EDGE_LENGTH = 170;
const DEVICE_REPOSITION_DISTANCE = 100;
const SPRING_STRENGTH = 0.005;
const REPULSION_FORCE = 2400;
const CENTERING_FORCE = 0.008;
const DEVICE_EDGE_ATTRACTION_BOOST = 1.25;
const MAX_VELOCITY = 4.5;
const EDGE_TARGET_FACTOR = 0.6;
const EDGE_MIN_GAP = 28;
const EDGE_ATTRACTION_MULTIPLIER = 1.8;
const EDGE_SETTLE_MULTIPLIER = 0.7;
const EDGE_COMPRESSION_MULTIPLIER = 2.4;
const EDGE_NODE_AVOIDANCE_RADIUS = 32;
const EDGE_NODE_REPULSION = 0.22;
const EDGE_NODE_REACTION_SHARING = 0.45;
const EDGE_NODE_MAX_ADJUSTMENT = 1.4;

const state = {
    graph: null,
    hoverNode: null,
    isConnectionPickerOpen: false,
    isConnecting: false,
    isDisconnecting: false,
    selectedNode: null,
    pointer: { x: 0, y: 0 },
    bounds: { width: canvas.clientWidth, height: canvas.clientHeight },
    isDrawerOpen: false,
    activeDrawer: null,
    packetStreams: new Map(),
    activePacketHubId: null,
    deviceStreams: new Map(),
    activeDeviceId: null,
    deviceChatView: "chat",
    packetAnimations: [],
    packetHighlights: new Map(),
    animationTime: 0,
    agentFormCache: null,
};

const stateStream = {
    socket: null,
    reconnectTimer: null,
    attempts: 0,
    lastUrl: null,
    shouldAnnounce: false,
};

const PACKET_HISTORY_LIMIT = 200;
const PACKET_STATUS_TEXT = {
    idle: "未接続",
    connecting: "接続中...",
    open: "受信中",
    closed: "切断",
    error: "エラー",
};

const DEVICE_HISTORY_LIMIT = 400;
const DEVICE_STATUS_TEXT = {
    idle: "未接続",
    connecting: "接続中...",
    open: "受信中",
    closed: "切断",
    error: "エラー",
};

const PACKET_ANIMATION_DURATION = 1200;
const PACKET_ANIMATION_RADIUS = 5;
const PACKET_TYPE_COLORS = {
    TALK: "rgba(102, 217, 239, 0.88)",
    WHISPER: "rgba(174, 129, 255, 0.88)",
    TEXT: "rgba(133, 255, 214, 0.9)",
    PING: "rgba(255, 196, 92, 0.9)",
    JOIN: "rgba(124, 255, 164, 0.88)",
    LEAVE: "rgba(255, 140, 140, 0.88)",
};
const PACKET_DEFAULT_COLOR = "rgba(255, 255, 255, 0.78)";
const DEVICE_STREAMING_PULSE_PERIOD = 2000;
const DEVICE_STREAMING_HALO_OFFSET = 8;
const DEVICE_STREAMING_HALO_RANGE = 10;

const DEFAULT_AGENT_CONFIG = {
    model: "gpt-4o",
    situation: "",
    runAI: true,
    isReasoning: false,
    debug: false,
    coolTime: 0.2,
    timeOut: 10,
};

const AGENT_FORM_STORAGE_KEY = "aihub.agentFormCache";

function loadAgentFormCacheFromStorage() {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const storage = window.localStorage;
        if (!storage) {
            return null;
        }
        const raw = storage.getItem(AGENT_FORM_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn("Failed to load agent form cache", error);
        return null;
    }
}

function persistAgentFormCache(cache) {
    state.agentFormCache = cache;
    if (typeof window === "undefined") {
        return;
    }
    try {
        const storage = window.localStorage;
        storage?.setItem(AGENT_FORM_STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn("Failed to persist agent form cache", error);
    }
}

function getAgentFormCache() {
    if (state.agentFormCache) {
        return state.agentFormCache;
    }
    const cache = loadAgentFormCacheFromStorage();
    if (cache) {
        state.agentFormCache = cache;
    }
    return cache;
}

if (deleteHubButton) {
    deleteHubButton.disabled = true;
}

if (addConnectionButton) {
    addConnectionButton.disabled = true;
}

setAgentFormDefaults({ preserveHub: true });

const currentOrigin = window.location.origin;
if (currentOrigin && currentOrigin !== "null") {
    apiInput.value = currentOrigin;
} else if (!apiInput.value) {
    apiInput.value = "http://localhost:8000";
}

if (deviceChatTabChat) {
    deviceChatTabChat.addEventListener("click", () => {
        if (state.deviceChatView === "chat") {
            return;
        }
        state.deviceChatView = "chat";
        if (state.activeDeviceId) {
            renderDeviceChat(state.activeDeviceId);
        }
    });
}

if (deviceChatTabDirectory) {
    deviceChatTabDirectory.addEventListener("click", () => {
        if (state.deviceChatView === "directory") {
            return;
        }
        state.deviceChatView = "directory";
        if (state.activeDeviceId) {
            renderDeviceChat(state.activeDeviceId);
        }
    });
}

function setStatus(message, variant = "idle") {
    statusIndicator.textContent = message;
    statusIndicator.className = `status status-${variant}`;
}

function setStatusIfNotBusy(message) {
    if (!statusIndicator) {
        return;
    }
    if (
        statusIndicator.classList.contains("status-loading") ||
        statusIndicator.classList.contains("status-error")
    ) {
        return;
    }
    setStatus(message, "idle");
}

function getBaseUrl() {
    return apiInput.value.trim().replace(/\/+$/, "");
}

function getAnimationTimestamp() {
    if (Number.isFinite(state.animationTime) && state.animationTime > 0) {
        return state.animationTime;
    }
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function getDeviceStreamingFlag(device) {
    if (!device || typeof device !== "object") {
        return false;
    }
    if (Object.prototype.hasOwnProperty.call(device, "isStreaming")) {
        return Boolean(device.isStreaming);
    }
    if (Object.prototype.hasOwnProperty.call(device, "is_streaming")) {
        return Boolean(device.is_streaming);
    }
    return false;
}

function getHubNodeById(uuid) {
    if (!state.graph) {
        return null;
    }
    return state.graph.nodes.find((node) => node.type === HUB_TYPE && node.id === uuid) || null;
}

function updateInfoPanelVisibility() {
    if (!infoPanel) {
        return;
    }
    const packetVisible = packetStreamSection && !packetStreamSection.classList.contains("hidden");
    const deviceChatVisible = deviceChatSection && !deviceChatSection.classList.contains("hidden");
    const detailsVisible = detailsPanel && !detailsPanel.classList.contains("hidden");
    if (packetVisible || deviceChatVisible || detailsVisible) {
        infoPanel.classList.remove("hidden");
    } else {
        infoPanel.classList.add("hidden");
    }
}

function getNodeDisplayName(uuid) {
    if (!uuid) {
        return null;
    }
    const normalized = typeof uuid === "string" ? uuid : String(uuid);
    if (state.graph && Array.isArray(state.graph.nodes)) {
        const node = state.graph.nodes.find((item) => item.id === normalized);
        if (node && node.label) {
            return node.label;
        }
    }
    if (normalized.length > 12) {
        return `${normalized.slice(0, 8)}...`;
    }
    return normalized;
}

function getHubDisplayLabel(uuid) {
    if (!uuid) {
        return "未接続";
    }
    const hubNode = getHubNodeById(uuid);
    if (hubNode && hubNode.label) {
        return hubNode.label;
    }
    return getNodeDisplayName(uuid) || String(uuid);
}

function setHubDisplay(element, hubUuid) {
    if (!element) {
        return;
    }
    if (!hubUuid) {
        element.textContent = "未接続";
        element.removeAttribute("title");
        return;
    }
    const label = getHubDisplayLabel(hubUuid);
    element.textContent = label;
    element.setAttribute("title", `${label} (${hubUuid})`);
}

function setAgentFormDefaults({ preserveName = false, preserveHub = true } = {}) {
    const cache = getAgentFormCache() || {};

    if (agentNameInput && !preserveName) {
        agentNameInput.value = "";
    }
    if (agentModelInput) {
        const model =
            typeof cache.model === "string" && cache.model.trim().length > 0
                ? cache.model
                : DEFAULT_AGENT_CONFIG.model;
        agentModelInput.value = model;
    }
    if (agentSituationInput) {
        const situation = typeof cache.situation === "string" ? cache.situation : DEFAULT_AGENT_CONFIG.situation;
        agentSituationInput.value = situation;
    }
    if (agentRunAICheckbox) {
        agentRunAICheckbox.checked =
            typeof cache.runAI === "boolean" ? cache.runAI : DEFAULT_AGENT_CONFIG.runAI;
    }
    if (agentReasoningCheckbox) {
        agentReasoningCheckbox.checked =
            typeof cache.isReasoning === "boolean" ? cache.isReasoning : DEFAULT_AGENT_CONFIG.isReasoning;
    }
    if (agentDebugCheckbox) {
        agentDebugCheckbox.checked =
            typeof cache.debug === "boolean" ? cache.debug : DEFAULT_AGENT_CONFIG.debug;
    }
    if (agentCoolTimeInput) {
        const coolTime =
            typeof cache.coolTime === "number" && Number.isFinite(cache.coolTime)
                ? cache.coolTime
                : DEFAULT_AGENT_CONFIG.coolTime;
        agentCoolTimeInput.value = String(coolTime);
    }
    if (agentTimeoutInput) {
        const timeout =
            typeof cache.timeOut === "number" && Number.isFinite(cache.timeOut)
                ? cache.timeOut
                : DEFAULT_AGENT_CONFIG.timeOut;
        agentTimeoutInput.value = String(timeout);
    }
    if (agentHubSelect) {
        const cachedHub = typeof cache.hubUuid === "string" ? cache.hubUuid : "";
        const shouldKeepCurrent = preserveHub && agentHubSelect.value;
        if (!shouldKeepCurrent) {
            if (cachedHub) {
                agentHubSelect.value = cachedHub;
            } else if (!preserveHub) {
                agentHubSelect.value = "";
            }
        }
    }
}

function getNumberFromInput(input, fallback) {
    if (!input) {
        return fallback;
    }
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? value : fallback;
}

function ensurePacketStreamEntry(hubId) {
    let entry = state.packetStreams.get(hubId);
    if (!entry) {
        entry = { socket: null, messages: [], status: "idle" };
        state.packetStreams.set(hubId, entry);
    }
    return entry;
}

function ensureDeviceStreamEntry(deviceId) {
    let entry = state.deviceStreams.get(deviceId);
    if (!entry) {
        entry = {
            socket: null,
            status: "idle",
            messages: [],
            contacts: { entries: [], timestamp: null },
            assistantResponses: new Map(),
            toolCalls: new Map(),
            isStreaming: false,
        };
        state.deviceStreams.set(deviceId, entry);
        if (state.graph && Array.isArray(state.graph.nodes)) {
            const node = state.graph.nodes.find((item) => item.id === deviceId);
            if (node && typeof node.isStreaming === "boolean") {
                entry.isStreaming = node.isStreaming;
            }
        }
    } else if (!entry.contacts) {
        entry.contacts = { entries: [], timestamp: null };
    }
    if (typeof entry.isStreaming !== "boolean") {
        entry.isStreaming = false;
    }
    return entry;
}

function hidePacketStream() {
    if (!packetStreamSection || !packetMessages || !packetStreamStatus) {
        return;
    }
    state.activePacketHubId = null;
    packetStreamSection.classList.add("hidden");
    packetMessages.innerHTML = "";
    packetStreamStatus.textContent = PACKET_STATUS_TEXT.idle;
    packetStreamStatus.classList.remove("is-active", "is-error");
    updateInfoPanelVisibility();
}

function hideDeviceChat() {
    if (!deviceChatSection || !deviceChatStatus) {
        return;
    }
    const activeId = state.activeDeviceId;
    if (activeId) {
        const entry = state.deviceStreams.get(activeId);
        if (entry && entry.socket) {
            try {
                entry.socket.close();
            } catch (error) {
                console.warn("Failed to close device event socket", error);
            }
            entry.socket = null;
            entry.status = "closed";
        }
        state.activeDeviceId = null;
    }
    state.deviceChatView = "chat";
    deviceChatSection.classList.add("hidden");
    deviceChatSection.classList.remove("is-streaming");
    if (deviceChatMessages) {
        deviceChatMessages.innerHTML = "";
        deviceChatMessages.classList.remove("hidden");
        deviceChatMessages.setAttribute("aria-hidden", "false");
    }
    if (deviceNameDirectory) {
        deviceNameDirectory.innerHTML = "";
        deviceNameDirectory.classList.add("hidden");
        deviceNameDirectory.setAttribute("aria-hidden", "true");
    }
    deviceChatStatus.textContent = DEVICE_STATUS_TEXT.idle;
    deviceChatStatus.classList.remove("is-active", "is-error");
    deviceChatStatus.classList.remove("is-streaming");
    if (deviceChatTabChat) {
        deviceChatTabChat.classList.add("is-active");
        deviceChatTabChat.setAttribute("aria-selected", "true");
    }
    if (deviceChatTabDirectory) {
        deviceChatTabDirectory.classList.remove("is-active");
        deviceChatTabDirectory.setAttribute("aria-selected", "false");
    }
    updateInfoPanelVisibility();
}

function updateDeviceStreamingIndicator(deviceId, entry, options = {}) {
    if (!entry) {
        return false;
    }
    const override = Object.prototype.hasOwnProperty.call(options, "overrideStreaming")
        ? options.overrideStreaming
        : undefined;
    let isStreaming;
    if (typeof override === "boolean") {
        isStreaming = override;
    } else if (entry.assistantResponses instanceof Map && entry.assistantResponses.size > 0) {
        isStreaming = Array.from(entry.assistantResponses.values()).some(
            (message) => message && typeof message === "object" && message.status === "streaming",
        );
    } else {
        isStreaming = Boolean(entry.isStreaming);
    }

    entry.isStreaming = isStreaming;

    if (state.graph && Array.isArray(state.graph.nodes)) {
        const node = state.graph.nodes.find((item) => item.id === deviceId);
        if (node) {
            const wasStreaming = Boolean(node.isStreaming);
            if (wasStreaming !== isStreaming) {
                node.isStreaming = isStreaming;
                if (isStreaming) {
                    node.streamingSince = getAnimationTimestamp();
                } else {
                    node.streamingSince = null;
                }
            } else if (isStreaming && (node.streamingSince === null || node.streamingSince === undefined)) {
                node.streamingSince = getAnimationTimestamp();
            }
        }
    }

    return isStreaming;
}

function getWebSocketUrlForHub(hubId) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        return null;
    }
    try {
        const url = new URL(baseUrl);
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const path = url.pathname.replace(/\/+$/, "");
        return `${protocol}//${url.host}${path}/hubs/${hubId}/packets`;
    } catch {
        const normalized = baseUrl.replace(/\/+$/, "");
        const scheme = normalized.startsWith("https://") ? "wss://" : "ws://";
        const withoutScheme = normalized.replace(/^https?:\/\//, "");
        return `${scheme}${withoutScheme}/hubs/${hubId}/packets`;
    }
}

function getWebSocketUrlForDevice(deviceId) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        return null;
    }
    try {
        const url = new URL(baseUrl);
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const path = url.pathname.replace(/\/+$/, "");
        return `${protocol}//${url.host}${path}/devices/${deviceId}/events`;
    } catch {
        const normalized = baseUrl.replace(/\/+$/, "");
        const scheme = normalized.startsWith("https://") ? "wss://" : "ws://";
        const withoutScheme = normalized.replace(/^https?:\/\//, "");
        return `${scheme}${withoutScheme}/devices/${deviceId}/events`;
    }
}

function getUpdatesWebSocketUrl() {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        return null;
    }
    try {
        const url = new URL(baseUrl);
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const path = url.pathname.replace(/\/+$/, "");
        return `${protocol}//${url.host}${path}/updates`;
    } catch {
        const normalized = baseUrl.replace(/\/+$/, "");
        const scheme = normalized.startsWith("https://") ? "wss://" : "ws://";
        const withoutScheme = normalized.replace(/^https?:\/\//, "");
        return `${scheme}${withoutScheme}/updates`;
    }
}

function createEdgeKey(idA, idB) {
    return [String(idA), String(idB)].sort().join("--");
}

function getPacketColor(packetType) {
    if (!packetType) {
        return PACKET_DEFAULT_COLOR;
    }
    const key = String(packetType).toUpperCase();
    return PACKET_TYPE_COLORS[key] || PACKET_DEFAULT_COLOR;
}

function handlePacketTransferEvent(payload) {
    if (!payload || !state.graph || !Array.isArray(state.graph.nodes)) {
        return;
    }
    const sourceUuid = payload.sourceUuid;
    const targetUuid = payload.targetUuid;
    if (!sourceUuid || !targetUuid) {
        return;
    }
    const sourceId = String(sourceUuid);
    const targetId = String(targetUuid);
    const packet = payload.packet || {};
    const packetType = packet && packet.type ? String(packet.type) : "UNKNOWN";
    const nodeLookup = new Map(state.graph.nodes.map((node) => [node.id, node]));
    if (!nodeLookup.has(sourceId) || !nodeLookup.has(targetId)) {
        return;
    }
    const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    state.packetAnimations.push({
        sourceId,
        targetId,
        edgeKey: createEdgeKey(sourceId, targetId),
        startedAt,
        duration: PACKET_ANIMATION_DURATION,
        packetType,
        color: getPacketColor(packetType),
    });
    if (state.packetAnimations.length > 300) {
        state.packetAnimations.splice(0, state.packetAnimations.length - 300);
    }
}

function describeStreamReason(reason) {
    const labels = {
        init: "初期状態を取得しました",
        "hub.created": "ハブが追加されました",
        "hub.deleted": "ハブが削除されました",
        "hub.connection.created": "ハブ接続が更新されました",
        "hub.connection.removed": "ハブ接続が解除されました",
        "device.created": "デバイスが追加されました",
        "device.deleted": "デバイスが削除されました",
        "device.moved": "デバイスの接続が変更されました",
        "device.streaming": "デバイスの応答状態が更新されました",
    };
    const baseLabel = labels[reason] || "リアルタイム更新";
    const timestamp = new Date().toLocaleTimeString("ja-JP", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    return `${baseLabel} (${timestamp})`;
}

function handleStateStreamMessage(event) {
    let payload;
    try {
        payload = JSON.parse(event.data);
    } catch (error) {
        console.warn("Invalid state stream payload", error);
        return;
    }
    if (!payload || typeof payload !== "object") {
        return;
    }
    const eventType = payload.event;
    if (eventType === "keepalive") {
        return;
    }
    if (eventType === "packet.transfer") {
        handlePacketTransferEvent(payload);
        return;
    }
    const hubs = Array.isArray(payload.hubs) ? payload.hubs : null;
    const devices = Array.isArray(payload.devices) ? payload.devices : null;
    if (!hubs || !devices) {
        return;
    }
    const reason = payload.reason || (eventType === "state.init" ? "init" : undefined);
    const message = reason ? describeStreamReason(reason) : undefined;
    applyGraphUpdate(hubs, devices, { silent: true, statusMessage: message });
}

function scheduleStateStreamReconnect() {
    if (stateStream.reconnectTimer) {
        return;
    }
    stateStream.attempts += 1;
    const attempt = Math.min(stateStream.attempts, 6);
    const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
    stateStream.shouldAnnounce = true;
    stateStream.reconnectTimer = window.setTimeout(() => {
        stateStream.reconnectTimer = null;
        connectStateStream();
    }, delay);
}

function connectStateStream({ reset = false } = {}) {
    const wsUrl = getUpdatesWebSocketUrl();
    if (!wsUrl) {
        if (stateStream.socket) {
            try {
                stateStream.socket.close();
            } catch (error) {
                console.warn("Failed to close state stream without URL", error);
            }
            stateStream.socket = null;
            stateStream.lastUrl = null;
            stateStream.shouldAnnounce = false;
        }
        if (stateStream.reconnectTimer) {
            window.clearTimeout(stateStream.reconnectTimer);
            stateStream.reconnectTimer = null;
        }
        return;
    }
    if (stateStream.reconnectTimer) {
        window.clearTimeout(stateStream.reconnectTimer);
        stateStream.reconnectTimer = null;
    }
    if (stateStream.socket) {
        const existing = stateStream.socket;
        const isSameUrl = stateStream.lastUrl === wsUrl;
        if (!reset && isSameUrl && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return;
        }
        try {
            existing.close();
        } catch (error) {
            console.warn("Failed to close existing state stream", error);
        }
    }
    if (reset) {
        stateStream.attempts = 0;
        stateStream.shouldAnnounce = true;
    } else if (stateStream.attempts > 0) {
        stateStream.shouldAnnounce = true;
    }
    let socket;
    try {
        socket = new WebSocket(wsUrl);
    } catch (error) {
        console.error("Failed to open state stream", error);
        scheduleStateStreamReconnect();
        return;
    }
    stateStream.socket = socket;
    stateStream.lastUrl = wsUrl;
    socket.addEventListener("open", () => {
        stateStream.attempts = 0;
        if (stateStream.shouldAnnounce) {
            setStatusIfNotBusy("リアルタイム更新に接続しました");
        }
        stateStream.shouldAnnounce = false;
    });
    socket.addEventListener("message", handleStateStreamMessage);
    socket.addEventListener("error", () => {
        setStatusIfNotBusy("リアルタイム接続でエラーが発生しました");
        socket.close();
    });
    socket.addEventListener("close", (event) => {
        if (stateStream.socket === socket) {
            stateStream.socket = null;
        }
        if (!event.wasClean) {
            setStatusIfNotBusy("リアルタイム接続が中断されました。再接続します…");
        }
        scheduleStateStreamReconnect();
    });
}

function formatPacketType(type) {
    if (!type) {
        return "UNKNOWN";
    }
    return type
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatPacketTime(timestamp) {
    if (!timestamp) {
        return "";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleTimeString("ja-JP", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatDeviceEventTime(timestamp) {
    return formatPacketTime(timestamp);
}

function stringifyForDisplay(value) {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        console.warn("Failed to stringify value for display", error);
        return String(value);
    }
}

function formatReasoning(reasoning) {
    if (reasoning === undefined || reasoning === null) {
        return null;
    }
    if (typeof reasoning === "string") {
        return reasoning;
    }
    if (Array.isArray(reasoning)) {
        if (reasoning.length === 0) {
            return null;
        }
        if (reasoning.every((item) => typeof item === "string")) {
            return reasoning.join("");
        }
        try {
            return JSON.stringify(reasoning, null, 2);
        } catch (error) {
            console.warn("Failed to stringify reasoning array", error);
            return String(reasoning);
        }
    }
    try {
        return JSON.stringify(reasoning, null, 2);
    } catch (error) {
        console.warn("Failed to stringify reasoning payload", error);
        return String(reasoning);
    }
}

function normalizeReasoning(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (Array.isArray(value)) {
        const flattened = [];
        value.forEach((item) => {
            if (Array.isArray(item)) {
                flattened.push(...item);
            } else if (item !== undefined && item !== null) {
                flattened.push(item);
            }
        });
        return flattened.length > 0 ? flattened : null;
    }
    return [value];
}

function appendReasoning(existing, incoming) {
    const base = normalizeReasoning(existing) || [];
    const addition = normalizeReasoning(incoming);
    if (!addition || addition.length === 0) {
        return base.length > 0 ? base : null;
    }
    const combined = base.concat(addition);
    return combined.length > 0 ? combined : null;
}

function buildPacketMessageElement(entry) {
    const { packet, receivedAt } = entry;
    const isTalk = packet.type === "TALK";
    const message = document.createElement("article");
    message.className = `packet-message ${isTalk ? "packet-message--talk" : "packet-message--system"}`;

    const senderName = getNodeDisplayName(packet.sender) || "Unknown";
    const timeText = formatPacketTime(receivedAt);

    const meta = document.createElement("div");
    meta.className = "packet-message__meta";

    if (isTalk) {
        const author = document.createElement("span");
        author.className = "packet-message__author";
        author.textContent = senderName;
        meta.appendChild(author);
    } else {
        const typeBadge = document.createElement("span");
        typeBadge.className = "packet-message__type";
        typeBadge.textContent = formatPacketType(packet.type);
        meta.appendChild(typeBadge);

        const origin = document.createElement("span");
        origin.className = "packet-message__origin";
        origin.textContent = senderName;
        meta.appendChild(origin);
    }

    if (timeText) {
        const time = document.createElement("time");
        time.className = "packet-message__time";
        if (receivedAt !== undefined && receivedAt !== null) {
            const date = new Date(receivedAt);
            if (!Number.isNaN(date.getTime())) {
                time.dateTime = date.toISOString();
            }
        }
        time.textContent = timeText;
        meta.appendChild(time);
    }

    message.appendChild(meta);

    const bubble = document.createElement("div");
    bubble.className = "packet-message__bubble";

    if (isTalk) {
        const content = typeof packet.context === "string" ? packet.context.trim() : "";
        bubble.textContent = content || "メッセージなし";
    } else {
        const content = typeof packet.context === "string" ? packet.context.trim() : "";
        bubble.textContent = content || "コンテキストなし";
    }

    message.appendChild(bubble);

    return message;
}

function buildDeviceChatMessageElement(message) {
    const variant = (() => {
        switch (message.type) {
            case "user":
                return "user";
            case "assistant":
                return "assistant";
            case "tool-call":
            case "tool-result":
                return "tool";
            default:
                return "system";
        }
    })();

    const article = document.createElement("article");
    article.className = `chat-message chat-message--${variant}`;

    const meta = document.createElement("div");
    meta.className = "chat-message__meta";
    const author = document.createElement("span");
    author.className = "chat-message__author";

    const authorLabels = {
        user: "ユーザー",
        assistant: "アシスタント",
        "tool-call": "ツール呼び出し",
        "tool-result": "ツール結果",
        system: "システム",
    };

    author.textContent = authorLabels[message.type] || "イベント";
    meta.appendChild(author);

    if (message.type === "assistant" && message.status === "streaming") {
        const status = document.createElement("span");
        status.className = "chat-message__status";
        status.textContent = "生成中…";
        meta.appendChild(status);
    } else if (message.type === "assistant" && message.status === "interrupted") {
        const status = document.createElement("span");
        status.className = "chat-message__status";
        status.textContent = "中断";
        meta.appendChild(status);
    } else if (message.type === "assistant" && message.finishReason && message.finishReason !== "stop") {
        const status = document.createElement("span");
        status.className = "chat-message__status";
        status.textContent = `finish: ${message.finishReason}`;
        meta.appendChild(status);
    }

    if (message.type === "tool-call" && message.name) {
        const badge = document.createElement("span");
        badge.className = "chat-message__badge";
        badge.textContent = message.name;
        meta.appendChild(badge);
    }

    if (message.timestamp) {
        const time = document.createElement("time");
        time.dateTime = message.timestamp;
        time.textContent = formatDeviceEventTime(message.timestamp);
        meta.appendChild(time);
    }

    article.appendChild(meta);

    const bubble = document.createElement("div");
    bubble.className = "chat-message__bubble";

    if (message.type === "user") {
        const content = stringifyForDisplay(message.content).trim();
        bubble.textContent = content || "（メッセージなし）";
    } else if (message.type === "assistant") {
        const content = stringifyForDisplay(message.content).trim();
        bubble.textContent = content || (message.status === "streaming" ? "生成中…" : "（応答なし）");
        const reasoning = formatReasoning(message.reasoning);
        if (reasoning) {
            const separator = document.createElement("div");
            separator.className = "chat-message__separator";
            bubble.appendChild(separator);
            const label = document.createElement("div");
            label.className = "chat-message__label";
            label.textContent = "Reasoning";
            bubble.appendChild(label);
            const pre = document.createElement("pre");
            pre.textContent = reasoning;
            bubble.appendChild(pre);
        }
    } else if (message.type === "tool-call") {
        const label = document.createElement("div");
        label.className = "chat-message__label";
        label.textContent = message.name ? `Call: ${message.name}` : "Call";
        bubble.appendChild(label);
        if (message.arguments !== undefined) {
            const pre = document.createElement("pre");
            pre.textContent = stringifyForDisplay(message.arguments);
            bubble.appendChild(pre);
        }
        if (message.responseId) {
            const status = document.createElement("span");
            status.className = "chat-message__status";
            status.textContent = `response #${message.responseId}`;
            bubble.appendChild(status);
        }
        if (message.result !== undefined) {
            const separator = document.createElement("div");
            separator.className = "chat-message__separator";
            bubble.appendChild(separator);
            const resultLabel = document.createElement("div");
            resultLabel.className = "chat-message__label";
            resultLabel.textContent = "Result";
            bubble.appendChild(resultLabel);
            const pre = document.createElement("pre");
            pre.textContent = stringifyForDisplay(message.result);
            bubble.appendChild(pre);
        }
    } else if (message.type === "tool-result") {
        const label = document.createElement("div");
        label.className = "chat-message__label";
        label.textContent = "Result";
        bubble.appendChild(label);
        const pre = document.createElement("pre");
        pre.textContent = stringifyForDisplay(message.result);
        bubble.appendChild(pre);
    } else {
        const content = stringifyForDisplay(message.content).trim();
        bubble.textContent = content || "（通知）";
    }

    article.appendChild(bubble);
    return article;
}

function renderPacketStream(hubId) {
    if (!packetStreamSection || !packetMessages || !packetStreamStatus) {
        return;
    }
    if (state.activePacketHubId !== hubId) {
        return;
    }
    packetStreamSection.classList.remove("hidden");
    updateInfoPanelVisibility();
    const entry = state.packetStreams.get(hubId);
    const statusKey = entry ? entry.status : "idle";
    packetStreamStatus.textContent = PACKET_STATUS_TEXT[statusKey] || PACKET_STATUS_TEXT.idle;
    packetStreamStatus.classList.toggle("is-active", statusKey === "open");
    packetStreamStatus.classList.toggle("is-error", statusKey === "error");

    const shouldStick =
        packetMessages.scrollHeight - packetMessages.clientHeight - packetMessages.scrollTop < 24;
    packetMessages.innerHTML = "";

    if (!entry || entry.messages.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "packet-stream__empty";
        if (statusKey === "error") {
            placeholder.textContent = "ストリームに接続できませんでした";
        } else if (statusKey === "open" || statusKey === "connecting") {
            placeholder.textContent = "まだパケットは届いていません";
        } else {
            placeholder.textContent = "接続待ちです";
        }
        packetMessages.appendChild(placeholder);
        return;
    }

    entry.messages.forEach((eventEntry) => {
        const element = buildPacketMessageElement(eventEntry);
        packetMessages.appendChild(element);
    });

    if (shouldStick) {
        packetMessages.scrollTop = packetMessages.scrollHeight;
    }
}

function renderDeviceChatMessagesView(entry, statusKey) {
    if (!deviceChatMessages) {
        return;
    }
    const shouldStick =
        deviceChatMessages.scrollHeight - deviceChatMessages.clientHeight - deviceChatMessages.scrollTop < 24;
    deviceChatMessages.innerHTML = "";

    if (!entry || entry.messages.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "device-chat__empty";
        if (statusKey === "error") {
            placeholder.textContent = "イベントストリームに接続できませんでした";
        } else if (statusKey === "open" || statusKey === "connecting") {
            placeholder.textContent = "まだイベントは届いていません";
        } else {
            placeholder.textContent = "接続待ちです";
        }
        deviceChatMessages.appendChild(placeholder);
        return;
    }

    entry.messages.forEach((message) => {
        const element = buildDeviceChatMessageElement(message);
        deviceChatMessages.appendChild(element);
    });

    if (shouldStick) {
        deviceChatMessages.scrollTop = deviceChatMessages.scrollHeight;
    }
}

function renderDeviceDirectoryView(entry, statusKey) {
    if (!deviceNameDirectory) {
        return;
    }
    const shouldStick =
        deviceNameDirectory.scrollHeight - deviceNameDirectory.clientHeight - deviceNameDirectory.scrollTop < 24;
    deviceNameDirectory.innerHTML = "";

    const contactState = entry && entry.contacts ? entry.contacts : { entries: [], timestamp: null };
    const updatedAt = contactState.timestamp;
    if (updatedAt) {
        const meta = document.createElement("div");
        meta.className = "device-directory__meta";
        const label = document.createElement("span");
        label.textContent = "最終更新";
        const timeEl = document.createElement("time");
        timeEl.dateTime = updatedAt;
        timeEl.textContent = formatDeviceEventTime(updatedAt) || updatedAt;
        meta.appendChild(label);
        meta.appendChild(document.createTextNode(": "));
        meta.appendChild(timeEl);
        deviceNameDirectory.appendChild(meta);
    }

    const entries = Array.isArray(contactState.entries) ? contactState.entries.slice() : [];
    if (entries.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "device-directory__empty";
        if (statusKey === "error") {
            placeholder.textContent = "イベントストリームに接続できませんでした";
        } else if (statusKey === "open" || statusKey === "connecting") {
            placeholder.textContent = "まだ登録された名前はありません";
        } else {
            placeholder.textContent = "接続待ちです";
        }
        deviceNameDirectory.appendChild(placeholder);
        return;
    }

    entries.sort((a, b) => {
        const aliasA = a && a.alias !== undefined && a.alias !== null ? String(a.alias).toLowerCase() : "";
        const aliasB = b && b.alias !== undefined && b.alias !== null ? String(b.alias).toLowerCase() : "";
        if (aliasA < aliasB) {
            return -1;
        }
        if (aliasA > aliasB) {
            return 1;
        }
        return 0;
    });

    const table = document.createElement("table");
    table.className = "device-directory__table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["登録名", "本当の名前", "UUID"].forEach((title) => {
        const th = document.createElement("th");
        th.textContent = title;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    entries.forEach((item) => {
        const row = document.createElement("tr");

        const aliasCell = document.createElement("td");
        const aliasValue =
            item && item.alias !== undefined && item.alias !== null ? String(item.alias) : "";
        aliasCell.textContent = aliasValue.trim() !== "" ? aliasValue : "—";
        row.appendChild(aliasCell);

        const nameCell = document.createElement("td");
        const nameWrapper = document.createElement("div");
        nameWrapper.className = "device-directory__name";
        const normalizedKind =
            item && typeof item.kind === "string" ? item.kind.toLowerCase() : "unknown";
        let typeLabel = "";
        if (normalizedKind === "device") {
            typeLabel = "デバイス";
        } else if (normalizedKind === "hub") {
            typeLabel = "ハブ";
        } else if (normalizedKind && normalizedKind !== "unknown") {
            typeLabel = normalizedKind;
        }
        if (typeLabel) {
            const typeBadge = document.createElement("span");
            typeBadge.className = "device-directory__type";
            typeBadge.textContent = typeLabel;
            nameWrapper.appendChild(typeBadge);
        }
        const nameText = document.createElement("span");
        const displayNameValue =
            item && item.displayName !== undefined && item.displayName !== null
                ? String(item.displayName)
                : "";
        nameText.textContent = displayNameValue.trim() !== "" ? displayNameValue : "不明";
        nameWrapper.appendChild(nameText);
        nameCell.appendChild(nameWrapper);
        row.appendChild(nameCell);

        const uuidCell = document.createElement("td");
        const uuidCode = document.createElement("code");
        uuidCode.className = "device-directory__uuid";
        if (item && item.uuid) {
            uuidCode.textContent = String(item.uuid);
        } else {
            uuidCode.textContent = "";
        }
        uuidCell.appendChild(uuidCode);
        row.appendChild(uuidCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    deviceNameDirectory.appendChild(table);

    if (shouldStick) {
        deviceNameDirectory.scrollTop = deviceNameDirectory.scrollHeight;
    }
}

function renderDeviceChat(deviceId) {
    if (!deviceChatSection || !deviceChatStatus) {
        return;
    }
    if (state.activeDeviceId !== deviceId) {
        return;
    }
    deviceChatSection.classList.remove("hidden");
    updateInfoPanelVisibility();
    const entry = state.deviceStreams.get(deviceId);
    const statusKey = entry ? entry.status : "idle";
    deviceChatStatus.textContent = DEVICE_STATUS_TEXT[statusKey] || DEVICE_STATUS_TEXT.idle;
    deviceChatStatus.classList.toggle("is-active", statusKey === "open");
    deviceChatStatus.classList.toggle("is-error", statusKey === "error");
    let isStreaming = entry ? Boolean(entry.isStreaming) : false;
    if (!entry && state.graph && Array.isArray(state.graph.nodes)) {
        const node = state.graph.nodes.find((item) => item.id === deviceId);
        if (node && typeof node.isStreaming === "boolean") {
            isStreaming = node.isStreaming;
        }
    }
    deviceChatStatus.classList.toggle("is-streaming", isStreaming);
    deviceChatSection.classList.toggle("is-streaming", isStreaming);

    const viewMode = state.deviceChatView === "directory" ? "directory" : "chat";
    if (deviceChatTabChat) {
        deviceChatTabChat.classList.toggle("is-active", viewMode === "chat");
        deviceChatTabChat.setAttribute("aria-selected", viewMode === "chat" ? "true" : "false");
    }
    if (deviceChatTabDirectory) {
        deviceChatTabDirectory.classList.toggle("is-active", viewMode === "directory");
        deviceChatTabDirectory.setAttribute("aria-selected", viewMode === "directory" ? "true" : "false");
    }
    if (deviceChatMessages) {
        deviceChatMessages.classList.toggle("hidden", viewMode !== "chat");
        deviceChatMessages.setAttribute("aria-hidden", viewMode === "chat" ? "false" : "true");
    }
    if (deviceNameDirectory) {
        deviceNameDirectory.classList.toggle("hidden", viewMode !== "directory");
        deviceNameDirectory.setAttribute("aria-hidden", viewMode === "directory" ? "false" : "true");
    }

    if (viewMode === "directory") {
        renderDeviceDirectoryView(entry, statusKey);
    } else {
        renderDeviceChatMessagesView(entry, statusKey);
    }
}

function subscribeToHubPackets(hubId) {
    const entry = ensurePacketStreamEntry(hubId);
    if (
        entry.socket &&
        (entry.socket.readyState === WebSocket.OPEN || entry.socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }
    if (entry.socket) {
        try {
            entry.socket.close();
        } catch (error) {
            console.warn("Failed to close previous packet stream socket:", error);
        }
    }

    const wsUrl = getWebSocketUrlForHub(hubId);
    if (!wsUrl) {
        entry.status = "error";
        renderPacketStream(hubId);
        return;
    }

    try {
        const socket = new WebSocket(wsUrl);
        entry.socket = socket;
        entry.status = "connecting";
        renderPacketStream(hubId);

        socket.addEventListener("open", () => {
            entry.status = "open";
            renderPacketStream(hubId);
        });

        socket.addEventListener("message", (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (error) {
                console.warn("Invalid packet stream payload:", error);
                return;
            }
            if (!data) {
                return;
            }
            if (data.event === "ready") {
                entry.status = "open";
                renderPacketStream(hubId);
                return;
            }
            if (data.event === "keepalive") {
                return;
            }
            if (!data.packet) {
                return;
            }
            entry.messages.push({
                packet: data.packet,
                receivedAt: data.receivedAt || new Date().toISOString(),
            });
            if (entry.messages.length > PACKET_HISTORY_LIMIT) {
                entry.messages.splice(0, entry.messages.length - PACKET_HISTORY_LIMIT);
            }
            renderPacketStream(hubId);
        });

        socket.addEventListener("close", () => {
            entry.socket = null;
            if (entry.status !== "error") {
                entry.status = "closed";
            }
            renderPacketStream(hubId);
        });

        socket.addEventListener("error", () => {
            entry.status = "error";
            renderPacketStream(hubId);
        });
    } catch (error) {
        console.error("Failed to open packet stream socket:", error);
        entry.status = "error";
        renderPacketStream(hubId);
    }
}

function processDeviceEvent(deviceId, payload) {
    if (!payload || typeof payload !== "object") {
        return;
    }
    const entry = ensureDeviceStreamEntry(deviceId);
    const timestamp = payload.timestamp || payload.receivedAt || new Date().toISOString();
    const type = payload.type || "unknown";

    const pushMessage = (message) => {
        entry.messages.push(message);
        while (entry.messages.length > DEVICE_HISTORY_LIMIT) {
            const removed = entry.messages.shift();
            if (!removed) {
                continue;
            }
            if (removed.type === "assistant" && removed.responseId) {
                entry.assistantResponses.delete(removed.responseId);
            }
            if (removed.type === "tool-call" && removed.toolCallId) {
                entry.toolCalls.delete(removed.toolCallId);
            }
        }
    };
    const finalize = () => {
        updateDeviceStreamingIndicator(deviceId, entry);
    };

    if (type === "user.message") {
        const content = payload.message && typeof payload.message === "object" ? payload.message.content : null;
        pushMessage({
            id: `user-${timestamp}`,
            type: "user",
            content,
            timestamp,
        });
        finalize();
        return;
    }

    if (type === "assistant.delta") {
        const responseKey = payload.responseId || "__default";
        let message = entry.assistantResponses.get(responseKey);
        if (!message) {
            message = {
                id: `assistant-${responseKey}-${Date.now()}`,
                type: "assistant",
                content: "",
                reasoning: null,
                status: "streaming",
                responseId: payload.responseId || null,
                timestamp,
                finishReason: payload.finishReason || null,
            };
            entry.assistantResponses.set(responseKey, message);
            pushMessage(message);
        }
        if (payload.delta) {
            if (typeof payload.delta.content === "string") {
                message.content += payload.delta.content;
            }
            if (Object.prototype.hasOwnProperty.call(payload.delta, "reasoning")) {
                message.reasoning = appendReasoning(message.reasoning, payload.delta.reasoning);
            }
        }
        if (payload.finishReason) {
            message.finishReason = payload.finishReason;
            message.status = payload.finishReason === "interrupted" ? "interrupted" : "completed";
        }
        message.timestamp = timestamp;
        finalize();
        return;
    }

    if (type === "assistant.message") {
        const responseKey = payload.responseId || "__default";
        let message = entry.assistantResponses.get(responseKey);
        const content = payload.message && typeof payload.message === "object" ? payload.message.content : null;
        if (!message) {
            message = {
                id: `assistant-${responseKey}-${Date.now()}`,
                type: "assistant",
                content: content || "",
                reasoning: normalizeReasoning(payload.reasoning),
                status: "completed",
                responseId: payload.responseId || null,
                timestamp,
                finishReason: payload.finishReason || null,
            };
            entry.assistantResponses.set(responseKey, message);
            pushMessage(message);
        } else {
            if (content && !message.content) {
                message.content = content;
            }
            message.status = payload.finishReason === "interrupted" ? "interrupted" : "completed";
            message.timestamp = timestamp;
            if (payload.finishReason) {
                message.finishReason = payload.finishReason;
            }
            if (Object.prototype.hasOwnProperty.call(payload, "reasoning")) {
                const normalizedReasoning = normalizeReasoning(payload.reasoning);
                if (normalizedReasoning) {
                    message.reasoning = normalizedReasoning;
                }
            }
        }
        finalize();
        return;
    }

    if (type === "assistant.tool_call") {
        const toolCallId = payload.toolCallId || `tool-${Date.now()}`;
        const message = {
            id: `tool-call-${toolCallId}`,
            type: "tool-call",
            toolCallId,
            name: payload.name || null,
            arguments: payload.arguments,
            responseId: payload.responseId || null,
            timestamp,
        };
        entry.toolCalls.set(toolCallId, message);
        pushMessage(message);
        finalize();
        return;
    }

    if (type === "tool.result") {
        const toolCallId = payload.toolCallId || null;
        let message = toolCallId ? entry.toolCalls.get(toolCallId) : null;
        if (message) {
            message.result = payload.result;
            message.timestamp = timestamp;
        } else {
            message = {
                id: `tool-result-${toolCallId || Date.now()}`,
                type: "tool-result",
                toolCallId,
                result: payload.result,
                timestamp,
            };
            pushMessage(message);
        }
        finalize();
        return;
    }

    if (type === "assistant.interrupted") {
        const reasonText =
            payload.reason === "new_input"
                ? "推論が新しい入力で中断されました"
                : `推論が中断されました (${payload.reason || "reason unknown"})`;
        const latestAssistant = [...entry.messages].reverse().find((msg) => msg.type === "assistant");
        if (latestAssistant) {
            latestAssistant.status = "interrupted";
            latestAssistant.finishReason = "interrupted";
            latestAssistant.timestamp = timestamp;
        }
        pushMessage({
            id: `system-${Date.now()}`,
            type: "system",
            content: reasonText,
            timestamp,
        });
        finalize();
        return;
    }

    if (type === "contacts.directory") {
        const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
        const normalizedEntries = rawEntries
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return null;
                }
                const aliasValue =
                    Object.prototype.hasOwnProperty.call(item, "alias") && item.alias !== null
                        ? String(item.alias)
                        : "";
                const uuidValue =
                    Object.prototype.hasOwnProperty.call(item, "uuid") && item.uuid !== null
                        ? String(item.uuid)
                        : "";
                const displayNameValue = Object.prototype.hasOwnProperty.call(item, "displayName")
                    ? item.displayName === undefined || item.displayName === null
                        ? null
                        : String(item.displayName)
                    : null;
                const kindValue =
                    Object.prototype.hasOwnProperty.call(item, "kind") && item.kind !== null
                        ? String(item.kind)
                        : "unknown";
                return {
                    alias: aliasValue,
                    uuid: uuidValue,
                    displayName: displayNameValue,
                    kind: kindValue || "unknown",
                };
            })
            .filter((entryItem) => entryItem !== null);
        entry.contacts = {
            entries: normalizedEntries,
            timestamp,
        };
        finalize();
        return;
    }

    // Fallback for unhandled events
    pushMessage({
        id: `system-${Date.now()}`,
        type: "system",
        content: stringifyForDisplay(payload),
        timestamp,
    });
    finalize();
}

function subscribeToDeviceEvents(deviceId) {
    const entry = ensureDeviceStreamEntry(deviceId);
    if (
        entry.socket &&
        (entry.socket.readyState === WebSocket.OPEN || entry.socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }
    if (entry.socket) {
        try {
            entry.socket.close();
        } catch (error) {
            console.warn("Failed to close previous device event socket:", error);
        }
    }

    const wsUrl = getWebSocketUrlForDevice(deviceId);
    if (!wsUrl) {
        entry.status = "error";
        renderDeviceChat(deviceId);
        return;
    }

    try {
        const socket = new WebSocket(wsUrl);
        entry.socket = socket;
        entry.status = "connecting";
        renderDeviceChat(deviceId);

        socket.addEventListener("open", () => {
            entry.status = "open";
            updateDeviceStreamingIndicator(deviceId, entry);
            renderDeviceChat(deviceId);
        });

        socket.addEventListener("message", (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (error) {
                console.warn("Invalid device event payload:", error);
                return;
            }
            if (!data) {
                return;
            }
            if (data.event === "ready") {
                entry.status = "open";
                updateDeviceStreamingIndicator(deviceId, entry);
                renderDeviceChat(deviceId);
                return;
            }
            if (data.event === "keepalive") {
                return;
            }
            processDeviceEvent(deviceId, data);
            renderDeviceChat(deviceId);
        });

        socket.addEventListener("close", () => {
            if (entry.socket === socket) {
                entry.socket = null;
            }
            if (entry.status !== "error") {
                entry.status = "closed";
            }
            updateDeviceStreamingIndicator(deviceId, entry);
            renderDeviceChat(deviceId);
        });

        socket.addEventListener("error", () => {
            entry.status = "error";
            updateDeviceStreamingIndicator(deviceId, entry);
            renderDeviceChat(deviceId);
        });
    } catch (error) {
        console.error("Failed to open device event socket:", error);
        entry.status = "error";
        renderDeviceChat(deviceId);
    }
}

function setDrawerOpen(open, type) {
    if (!drawerBackdrop) {
        return;
    }

    const drawers = {
        hub: {
            element: hubDrawer,
            focus: () => {
                if (hubNameInput) {
                    hubNameInput.focus();
                }
            },
        },
        agent: {
            element: agentDrawer,
            focus: () => {
                if (agentNameInput) {
                    agentNameInput.focus();
                }
            },
        },
    };

    const targetType = type || state.activeDrawer || "hub";
    const config = drawers[targetType];
    if (!config || !config.element) {
        return;
    }

    if (open) {
        Object.entries(drawers).forEach(([key, value]) => {
            if (!value.element) {
                return;
            }
            if (key === targetType) {
                value.element.classList.add("is-open");
                value.element.setAttribute("aria-hidden", "false");
            } else {
                value.element.classList.remove("is-open");
                value.element.setAttribute("aria-hidden", "true");
            }
        });
        drawerBackdrop.classList.add("is-visible");
        drawerBackdrop.setAttribute("aria-hidden", "false");
        state.isDrawerOpen = true;
        state.activeDrawer = targetType;
        requestAnimationFrame(() => {
            config.focus?.();
        });
    } else {
        config.element.classList.remove("is-open");
        config.element.setAttribute("aria-hidden", "true");
        if (state.activeDrawer === targetType) {
            state.activeDrawer = null;
            state.isDrawerOpen = false;
            drawerBackdrop.classList.remove("is-visible");
            drawerBackdrop.setAttribute("aria-hidden", "true");
            if (targetType === "agent") {
                setAgentFormDefaults({ preserveHub: true });
            }
        }
    }
}

function toggleDrawer(type = "hub") {
    if (state.activeDrawer === type) {
        setDrawerOpen(false, type);
    } else {
        setDrawerOpen(true, type);
    }
}

function updateAgentHubOptions() {
    if (!agentHubSelect) {
        return;
    }

    const previousValue = agentHubSelect.value;
    agentHubSelect.innerHTML = "";

    const hubs = state.graph && Array.isArray(state.graph.nodes)
        ? state.graph.nodes.filter((node) => node.type === HUB_TYPE)
        : [];

    const placeholder = document.createElement("option");
    placeholder.value = "";

    if (!hubs || hubs.length === 0) {
        placeholder.textContent = "接続するハブを作成してください";
        agentHubSelect.appendChild(placeholder);
        agentHubSelect.value = "";
        agentHubSelect.disabled = true;
        if (createAgentButton) {
            createAgentButton.disabled = true;
            createAgentButton.dataset.disabledByHub = "true";
        }
        return;
    }

    placeholder.textContent = "ハブを選択してください";
    agentHubSelect.appendChild(placeholder);

    hubs
        .slice()
        .sort((a, b) => (a.label || "").localeCompare(b.label || "", "ja"))
        .forEach((hub) => {
            const option = document.createElement("option");
            option.value = hub.id;
            option.textContent = hub.label || getNodeDisplayName(hub.id) || hub.id;
            agentHubSelect.appendChild(option);
        });

    agentHubSelect.disabled = false;
    if (previousValue && hubs.some((hub) => hub.id === previousValue)) {
        agentHubSelect.value = previousValue;
    } else {
        agentHubSelect.value = "";
    }

    if (createAgentButton && createAgentButton.dataset.disabledByHub === "true") {
        delete createAgentButton.dataset.disabledByHub;
        if (!createAgentButton.dataset.submitting) {
            createAgentButton.disabled = false;
        }
    }
}

function hideDeviceHubEditor() {
    if (!deviceHubEditor) {
        return;
    }
    deviceHubEditor.classList.add("hidden");
    deviceHubEditor.dataset.deviceId = "";
    deviceHubEditor.dataset.currentHubId = "";
    if (deviceHubCurrent) {
        deviceHubCurrent.textContent = "";
        deviceHubCurrent.removeAttribute("title");
    }
    if (deviceHubSelect) {
        deviceHubSelect.innerHTML = "";
        deviceHubSelect.disabled = true;
    }
    if (deviceHubSaveButton) {
        deviceHubSaveButton.disabled = true;
        delete deviceHubSaveButton.dataset.pending;
    }
}

function updateDeviceHubSaveState() {
    if (!deviceHubEditor || !deviceHubSelect || !deviceHubSaveButton) {
        return;
    }
    const currentHubId = deviceHubEditor.dataset.currentHubId || "";
    const selectedHubId = deviceHubSelect.disabled ? "" : deviceHubSelect.value;
    const deviceId = deviceHubEditor.dataset.deviceId || "";
    if (!deviceId || !selectedHubId || selectedHubId === currentHubId) {
        deviceHubSaveButton.disabled = true;
    } else if (!deviceHubSaveButton.dataset.pending) {
        deviceHubSaveButton.disabled = false;
    }
}

function renderDeviceHubEditor(deviceNode) {
    if (!deviceHubEditor || !deviceHubSelect || !deviceHubSaveButton || !deviceHubCurrent) {
        return;
    }

    deviceHubEditor.dataset.deviceId = deviceNode.id;
    const currentHubId = deviceNode.info.hubUuid || "";
    deviceHubEditor.dataset.currentHubId = currentHubId;

    setHubDisplay(deviceHubCurrent, currentHubId);

    deviceHubSelect.innerHTML = "";

    if (!state.graph || !Array.isArray(state.graph.nodes)) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "接続先を取得できません";
        deviceHubSelect.appendChild(option);
        deviceHubSelect.disabled = true;
        deviceHubSaveButton.disabled = true;
        deviceHubEditor.classList.remove("hidden");
        return;
    }

    const hubs = state.graph.nodes
        .filter((node) => node.type === HUB_TYPE)
        .slice()
        .sort((a, b) => (a.label || "").localeCompare(b.label || "", "ja"));

    if (hubs.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "利用可能なハブがありません";
        deviceHubSelect.appendChild(option);
        deviceHubSelect.disabled = true;
        deviceHubSaveButton.disabled = true;
        deviceHubEditor.classList.remove("hidden");
        return;
    }

    hubs.forEach((hub) => {
        const option = document.createElement("option");
        option.value = hub.id;
        option.textContent = hub.label || getNodeDisplayName(hub.id) || hub.id;
        deviceHubSelect.appendChild(option);
    });

    if (currentHubId && hubs.some((hub) => hub.id === currentHubId)) {
        deviceHubSelect.value = currentHubId;
        deviceHubSelect.disabled = false;
    } else {
        deviceHubSelect.value = hubs[0].id;
        deviceHubSelect.disabled = false;
    }

    delete deviceHubSaveButton.dataset.pending;
    updateDeviceHubSaveState();
    deviceHubEditor.classList.remove("hidden");
}

async function changeDeviceHub(deviceId, targetHubId) {
    if (!deviceId || !targetHubId) {
        return;
    }
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        setStatus("APIエンドポイントを入力してください", "error");
        return;
    }
    if (!deviceHubSaveButton || !deviceHubSelect || !deviceHubEditor) {
        return;
    }

    deviceHubSaveButton.disabled = true;
    deviceHubSaveButton.dataset.pending = "true";
    deviceHubSelect.disabled = true;
    setStatus("接続先を更新中...", "loading");

    try {
        const response = await fetch(`${baseUrl}/devices/${deviceId}/hub`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hubUuid: targetHubId }),
        });

        if (!response.ok) {
            let detail = "";
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.detail === "string") {
                    detail = errorData.detail;
                }
            } catch (parseError) {
                // ignore
            }
            const message = detail ? `更新失敗: ${detail}` : "更新失敗";
            setStatus(message, "error");
            return;
        }

        deviceHubEditor.dataset.currentHubId = targetHubId;
        setHubDisplay(deviceHubCurrent, targetHubId);
        const reloaded = await loadGraph({ silent: true });
        if (reloaded) {
            setStatus("接続先を更新しました", "idle");
        }
    } catch (error) {
        console.error("Failed to update device hub:", error);
        setStatus("更新失敗", "error");
    } finally {
        delete deviceHubSaveButton.dataset.pending;
        deviceHubSelect.disabled = false;
        updateDeviceHubSaveState();
    }
}

function closeDetailsPanel() {
    state.selectedNode = null;
    hidePacketStream();
    hideDeviceChat();
    detailsPanel.classList.add("hidden");
    tooltip.classList.add("hidden");
    if (detailsActions) {
        detailsActions.classList.add("hidden");
    }
    if (deleteHubButton) {
        deleteHubButton.dataset.hubId = "";
        deleteHubButton.disabled = true;
    }
    if (connectionsSection) {
        connectionsSection.classList.add("hidden");
    }
    hideDeviceHubEditor();
    closeConnectionPicker(true);
    updateInfoPanelVisibility();
}

function closeConnectionPicker(force = false) {
    if (!connectionPicker) {
        return;
    }
    state.isConnectionPickerOpen = false;
    connectionPicker.classList.remove("is-open");
    connectionPicker.setAttribute("aria-hidden", "true");
    if (force) {
        connectionPicker.classList.add("hidden");
    } else {
        setTimeout(() => connectionPicker.classList.add("hidden"), 200);
    }
    if (!force && addConnectionButton && !addConnectionButton.disabled) {
        addConnectionButton.focus();
    }
}

async function connectHubs(sourceHubId, targetHubId, triggerButton) {
    if (state.isConnecting || state.isDisconnecting) {
        return;
    }
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        setStatus("APIエンドポイントを入力してください", "error");
        return;
    }

    state.isConnecting = true;
    setStatus("接続中...", "loading");
    if (triggerButton) {
        triggerButton.disabled = true;
    }
    connectionOptions?.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });

    try {
        const response = await fetch(`${baseUrl}/hubs/${sourceHubId}/connections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetHubUuid: targetHubId }),
        });

        if (!response.ok) {
            let detail = "";
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.detail === "string") {
                    detail = errorData.detail;
                }
            } catch (parseError) {
                // ignore parse error
            }
            const message = detail ? `接続失敗: ${detail}` : "接続失敗";
            setStatus(message, "error");
            return;
        }

        closeConnectionPicker();
        const reloaded = await loadGraph({ silent: true });
        if (reloaded) {
            setStatus("接続しました", "idle");
        }
    } catch (error) {
        console.error("Failed to connect hubs:", error);
        setStatus("接続失敗", "error");
    } finally {
        state.isConnecting = false;
        connectionOptions?.querySelectorAll("button").forEach((button) => {
            button.disabled = false;
        });
    }
}

async function disconnectHubs(sourceHubId, targetHubId, triggerButton) {
    if (state.isConnecting || state.isDisconnecting) {
        return;
    }

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        setStatus("APIエンドポイントを入力してください", "error");
        return;
    }

    state.isDisconnecting = true;
    setStatus("接続解除中...", "loading");

    const previousAddDisabled = addConnectionButton ? addConnectionButton.disabled : undefined;
    if (addConnectionButton) {
        addConnectionButton.disabled = true;
    }
    if (triggerButton) {
        triggerButton.disabled = true;
    }

    let success = false;
    try {
        const response = await fetch(`${baseUrl}/hubs/${sourceHubId}/connections/${targetHubId}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            let detail = "";
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.detail === "string") {
                    detail = errorData.detail;
                }
            } catch (parseError) {
                // ignore parse error
            }
            const message = detail ? `接続解除失敗: ${detail}` : "接続解除失敗";
            setStatus(message, "error");
            return;
        }

        const reloaded = await loadGraph({ silent: true });
        if (reloaded) {
            setStatus("接続を解除しました", "idle");
            success = true;
        } else {
            setStatus("接続解除は完了しましたが更新できませんでした", "error");
        }
    } catch (error) {
        console.error("Failed to disconnect hubs:", error);
        setStatus("接続解除失敗", "error");
    } finally {
        state.isDisconnecting = false;
        if (triggerButton && !success) {
            triggerButton.disabled = false;
        }
        if (addConnectionButton && previousAddDisabled !== undefined && !success) {
            addConnectionButton.disabled = previousAddDisabled;
        }
    }
}

function openConnectionPicker() {
    if (!connectionPicker || !state.selectedNode || state.selectedNode.type !== HUB_TYPE) {
        return;
    }
    if (!state.graph) {
        return;
    }

    const hubNode = state.selectedNode;
    const connected = hubNode.info.connectedHubs || [];
    const available = state.graph.nodes.filter(
        (node) =>
            node.type === HUB_TYPE &&
            node.id !== hubNode.id &&
            !connected.includes(node.id),
    );

    connectionOptions.innerHTML = "";
    if (available.length === 0) {
        const empty = document.createElement("div");
        empty.className = "picker-empty";
        empty.textContent = "接続可能なハブがありません";
        connectionOptions.appendChild(empty);
    } else {
        available.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "picker-option";
            button.textContent = option.label || "Hub";
            button.dataset.targetHubId = option.id;
            button.addEventListener("click", async () => {
                await connectHubs(hubNode.id, option.id, button);
            });
            connectionOptions.appendChild(button);
        });
    }

    state.isConnectionPickerOpen = true;
    connectionPicker.classList.remove("hidden");
    requestAnimationFrame(() => {
        connectionPicker.classList.add("is-open");
        connectionPicker.setAttribute("aria-hidden", "false");
        const focusTarget = connectionOptions.querySelector("button");
        focusTarget?.focus();
    });
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = canvas;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.bounds = { width: clientWidth, height: clientHeight };
}

function buildGraph(hubs, devices, previousGraph) {
    const previousNodes = new Map();
    if (previousGraph && Array.isArray(previousGraph.nodes)) {
        previousGraph.nodes.forEach((node) => {
            previousNodes.set(node.id, node);
        });
    }

    const nodeMap = new Map();
    const nodes = [];
    const edges = [];
    const now = getAnimationTimestamp();

    const centerX = state.bounds.width / 2;
    const centerY = state.bounds.height / 2;
    const radius = Math.min(state.bounds.width, state.bounds.height) / 3 || 200;

    hubs.forEach((hub, index) => {
        const angle = (index / Math.max(1, hubs.length)) * Math.PI * 2;
        const existing = previousNodes.get(hub.uuid);
        const node = existing || {
            id: hub.uuid,
            x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 80,
            y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 80,
            vx: 0,
            vy: 0,
            radius: 20,
            mass: 2.8,
            isStreaming: false,
            streamingSince: null,
        };
        node.label = hub.name || "Hub";
        node.type = HUB_TYPE;
        node.isStreaming = false;
        node.streamingSince = null;
        node.info = hub;
        const deviceCount = Array.isArray(hub.connectedDevices) ? hub.connectedDevices.length : 0;
        const hasOccupants = deviceCount > 0;
        node.color = hasOccupants ? "rgba(88, 213, 255, 0.95)" : "rgba(88, 213, 255, 0.4)";
        node.radius = hasOccupants ? 20 : 16;
        node.isEmptyHub = !hasOccupants;
        nodeMap.set(hub.uuid, node);
        nodes.push(node);
    });

    devices.forEach((device) => {
        const existing = previousNodes.get(device.uuid);
        const previousHub = existing && existing.info ? existing.info.hubUuid : null;
        const node = existing || {
            id: device.uuid,
            x: centerX + (Math.random() - 0.5) * radius * 1.5,
            y: centerY + (Math.random() - 0.5) * radius * 1.5,
            vx: 0,
            vy: 0,
            radius: 12,
            mass: 1.4,
            isStreaming: false,
            streamingSince: null,
        };
        node.label = device.name || "Device";
        node.type = DEVICE_TYPE;
        node.color = "rgba(255, 110, 199, 0.95)";
        if (existing && previousHub !== device.hubUuid) {
            const targetHub = device.hubUuid ? nodeMap.get(device.hubUuid) : null;
            if (targetHub) {
                const angle = Math.random() * Math.PI * 2;
                const distance = DEVICE_REPOSITION_DISTANCE * (0.6 + Math.random() * 0.6);
                node.x = targetHub.x + Math.cos(angle) * distance;
                node.y = targetHub.y + Math.sin(angle) * distance;
            } else {
                node.x = centerX + (Math.random() - 0.5) * radius;
                node.y = centerY + (Math.random() - 0.5) * radius;
            }
            node.vx = 0;
            node.vy = 0;
        }
        const isStreaming = getDeviceStreamingFlag(device);
        const wasStreaming = existing ? Boolean(existing.isStreaming) : false;
        node.isStreaming = isStreaming;
        if (isStreaming) {
            if (existing && wasStreaming && typeof existing.streamingSince === "number") {
                node.streamingSince = existing.streamingSince;
            } else {
                node.streamingSince = now;
            }
        } else {
            node.streamingSince = null;
        }
        node.info = device;
        nodeMap.set(device.uuid, node);
        nodes.push(node);
    });

    const edgeKeys = new Set();
    hubs.forEach((hub) => {
        const hubNode = nodeMap.get(hub.uuid);
        if (!hubNode) {
            return;
        }

        hub.connectedHubs.forEach((peerUuid) => {
            const target = nodeMap.get(peerUuid);
            if (!target) {
                return;
            }
            const key = [hub.uuid, peerUuid].sort().join("-");
            if (edgeKeys.has(key)) {
                return;
            }
            edgeKeys.add(key);
            edges.push({
                source: hubNode,
                target,
                type: HUB_TYPE,
                length: HUB_EDGE_LENGTH,
                spring: SPRING_STRENGTH,
            });
        });

        hub.connectedDevices.forEach((deviceUuid) => {
            const deviceNode = nodeMap.get(deviceUuid);
            if (!deviceNode) {
                return;
            }
            const key = `${hub.uuid}->${deviceUuid}`;
            if (edgeKeys.has(key)) {
                return;
            }
            edgeKeys.add(key);
            edges.push({
                source: hubNode,
                target: deviceNode,
                type: DEVICE_TYPE,
                length: DEVICE_EDGE_LENGTH,
                spring: SPRING_STRENGTH * 1.3,
            });
        });
    });

    devices.forEach((device) => {
        if (!device.hubUuid) {
            return;
        }
        const hubNode = nodeMap.get(device.hubUuid);
        const deviceNode = nodeMap.get(device.uuid);
        if (!hubNode || !deviceNode) {
            return;
        }
        const key = `${device.hubUuid}->${device.uuid}`;
        if (edgeKeys.has(key)) {
            return;
        }
        edgeKeys.add(key);
        edges.push({
            source: hubNode,
            target: deviceNode,
            type: DEVICE_TYPE,
            length: DEVICE_EDGE_LENGTH,
            spring: SPRING_STRENGTH * 1.2,
        });
    });

    return { nodes, edges };
}

function applyGraphUpdate(hubs, devices, { silent = false, statusMessage } = {}) {
    const previousSelectionId = state.selectedNode ? state.selectedNode.id : null;
    const previousGraph = state.graph;
    const newGraph = buildGraph(hubs, devices, previousGraph);
    if (!previousGraph) {
        state.graph = newGraph;
    } else {
        previousGraph.nodes.splice(0, previousGraph.nodes.length, ...newGraph.nodes);
        previousGraph.edges.splice(0, previousGraph.edges.length, ...newGraph.edges);
    }
    if (state.graph && Array.isArray(devices)) {
        devices.forEach((device) => {
            if (!device || typeof device !== "object") {
                return;
            }
            const deviceUuid = device.uuid || device.id;
            if (!deviceUuid) {
                return;
            }
            const entry = state.deviceStreams.get(deviceUuid);
            if (!entry) {
                return;
            }
            const override = getDeviceStreamingFlag(device);
            updateDeviceStreamingIndicator(deviceUuid, entry, { overrideStreaming: override });
        });
    }
    updateAgentHubOptions();
    if (statusMessage) {
        if (silent) {
            setStatusIfNotBusy(statusMessage);
        } else {
            setStatus(statusMessage, "idle");
        }
    } else if (!silent) {
        const timestamp = new Date().toLocaleTimeString("ja-JP", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        setStatus(`更新: ${timestamp}`, "idle");
    }
    if (previousSelectionId && silent && state.graph) {
        const refreshed = state.graph.nodes.find((node) => node.id === previousSelectionId);
        if (refreshed) {
            state.selectedNode = refreshed;
            updateDetailsPanel(refreshed);
        } else {
            closeDetailsPanel();
        }
    }
    return true;
}

function updatePacketAnimations(now) {
    const timestamp = Number.isFinite(now)
        ? now
        : (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    if (!state.graph || !Array.isArray(state.graph.nodes)) {
        if (state.packetAnimations.length > 0) {
            state.packetAnimations = [];
        }
        if (!(state.packetHighlights instanceof Map) || state.packetHighlights.size > 0) {
            state.packetHighlights = new Map();
        }
        return;
    }
    const nodeLookup = new Map(state.graph.nodes.map((node) => [node.id, node]));
    const activeAnimations = [];
    const highlights = new Map();

    for (const animation of state.packetAnimations) {
        const sourceNode = nodeLookup.get(animation.sourceId);
        const targetNode = nodeLookup.get(animation.targetId);
        if (!sourceNode || !targetNode) {
            continue;
        }
        const duration = animation.duration && animation.duration > 0
            ? animation.duration
            : PACKET_ANIMATION_DURATION;
        if (duration <= 0) {
            continue;
        }
        const elapsed = Math.max(0, timestamp - animation.startedAt);
        const progress = elapsed / duration;
        if (progress >= 1) {
            continue;
        }
        animation.sourceNode = sourceNode;
        animation.targetNode = targetNode;
        animation.progress = progress;
        activeAnimations.push(animation);

        const key = animation.edgeKey || createEdgeKey(sourceNode.id, targetNode.id);
        const intensity = Math.max(0, 1 - Math.abs(progress - 0.5) * 1.8);
        const previous = highlights.get(key);
        if (previous === undefined || intensity > previous) {
            highlights.set(key, intensity);
        }
    }

    state.packetAnimations = activeAnimations;
    state.packetHighlights = highlights;
}

function drawPacketAnimations(ctx) {
    if (!state.packetAnimations.length) {
        return;
    }
    for (const animation of state.packetAnimations) {
        const { sourceNode, targetNode, progress, color } = animation;
        if (!sourceNode || !targetNode || typeof progress !== "number") {
            continue;
        }
        const clampedProgress = Math.min(Math.max(progress, 0), 1);
        const x = sourceNode.x + (targetNode.x - sourceNode.x) * clampedProgress;
        const y = sourceNode.y + (targetNode.y - sourceNode.y) * clampedProgress;
        const radius = PACKET_ANIMATION_RADIUS;

        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.stroke();
        ctx.restore();
    }
}

function simulate(graph) {
    const { nodes, edges } = graph;
    const { width, height } = state.bounds;

    for (let i = 0; i < nodes.length; i += 1) {
        const nodeA = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
            const nodeB = nodes[j];
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distanceSquared = dx * dx + dy * dy + 0.01;
            const distance = Math.sqrt(distanceSquared);
            const force = (REPULSION_FORCE) / distanceSquared;
            const fx = (force * dx) / distance;
            const fy = (force * dy) / distance;

            nodeA.vx -= fx / nodeA.mass;
            nodeA.vy -= fy / nodeA.mass;
            nodeB.vx += fx / nodeB.mass;
            nodeB.vy += fy / nodeB.mass;
        }
    }

    edges.forEach((edge) => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;

        const minDistance = edge.source.radius + edge.target.radius + EDGE_MIN_GAP;
        const preferredDistance = Math.max(minDistance, edge.length * EDGE_TARGET_FACTOR);

        let difference = distance - preferredDistance;
        let multiplier = difference > 0 ? EDGE_ATTRACTION_MULTIPLIER : EDGE_SETTLE_MULTIPLIER;
        if (edge.type === DEVICE_TYPE && difference > 0) {
            multiplier *= DEVICE_EDGE_ATTRACTION_BOOST;
        }

        if (distance < minDistance) {
            difference = distance - minDistance;
            multiplier = EDGE_COMPRESSION_MULTIPLIER;
        }

        const force = edge.spring * difference * multiplier;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        edge.source.vx += fx / edge.source.mass;
        edge.source.vy += fy / edge.source.mass;
        edge.target.vx -= fx / edge.target.mass;
        edge.target.vy -= fy / edge.target.mass;
    });

    edges.forEach((edge) => {
        const ax = edge.source.x;
        const ay = edge.source.y;
        const bx = edge.target.x;
        const by = edge.target.y;
        const abx = bx - ax;
        const aby = by - ay;
        const abLengthSquared = abx * abx + aby * aby;

        if (abLengthSquared < 0.0001) {
            return;
        }

        nodes.forEach((node) => {
            if (node === edge.source || node === edge.target) {
                return;
            }

            const px = node.x;
            const py = node.y;
            const apx = px - ax;
            const apy = py - ay;

            let t = (apx * abx + apy * aby) / abLengthSquared;
            if (t <= 0 || t >= 1) {
                return;
            }

            const closestX = ax + abx * t;
            const closestY = ay + aby * t;
            const dx = px - closestX;
            const dy = py - closestY;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared <= 0) {
                return;
            }

            const distance = Math.sqrt(distanceSquared);
            const clearance = node.radius + EDGE_NODE_AVOIDANCE_RADIUS;

            if (distance >= clearance) {
                return;
            }

            const overlap = clearance - distance;
            const normalX = dx / distance;
            const normalY = dy / distance;
            const adjustment = Math.min(overlap * EDGE_NODE_REPULSION, EDGE_NODE_MAX_ADJUSTMENT);
            if (!Number.isFinite(adjustment) || adjustment <= 0) {
                return;
            }

            const pushX = normalX * adjustment;
            const pushY = normalY * adjustment;

            node.vx += pushX / node.mass;
            node.vy += pushY / node.mass;

            const reactionX = pushX * EDGE_NODE_REACTION_SHARING;
            const reactionY = pushY * EDGE_NODE_REACTION_SHARING;

            edge.source.vx -= reactionX / edge.source.mass;
            edge.source.vy -= reactionY / edge.source.mass;
            edge.target.vx -= reactionX / edge.target.mass;
            edge.target.vy -= reactionY / edge.target.mass;
        });
    });

    nodes.forEach((node) => {
        const dx = (width / 2) - node.x;
        const dy = (height / 2) - node.y;
        node.vx += dx * CENTERING_FORCE;
        node.vy += dy * CENTERING_FORCE;

        node.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, node.vx));
        node.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, node.vy));

        node.vx *= 0.9;
        node.vy *= 0.9;

        node.x += node.vx;
        node.y += node.vy;

        const margin = node.radius + 12;
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
    });
}

function draw(graph) {
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.bounds.width, state.bounds.height);

    const highlights = state.packetHighlights instanceof Map ? state.packetHighlights : null;
    graph.edges.forEach((edge) => {
        const edgeKey = createEdgeKey(edge.source.id, edge.target.id);
        const highlight = highlights ? highlights.get(edgeKey) || 0 : 0;
        const strength = Math.max(0, Math.min(1, highlight));
        const gradient = ctx.createLinearGradient(edge.source.x, edge.source.y, edge.target.x, edge.target.y);
        if (edge.type === HUB_TYPE) {
            const startAlpha = Math.min(1, 0.4 + strength * 0.45);
            const endAlpha = Math.min(1, 0.6 + strength * 0.4);
            gradient.addColorStop(0, `rgba(88, 213, 255, ${startAlpha})`);
            gradient.addColorStop(1, `rgba(38, 126, 255, ${endAlpha})`);
        } else {
            const startAlpha = Math.min(1, 0.35 + strength * 0.5);
            const endAlpha = Math.min(1, 0.55 + strength * 0.45);
            gradient.addColorStop(0, `rgba(255, 110, 199, ${startAlpha})`);
            gradient.addColorStop(1, `rgba(255, 169, 244, ${endAlpha})`);
        }
        ctx.lineWidth = 1.4 + strength * 2.4;
        ctx.lineCap = strength > 0 ? "round" : "butt";
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.stroke();
    });
    ctx.lineCap = "butt";
    drawPacketAnimations(ctx);

    graph.nodes.forEach((node) => {
        const isHover = state.hoverNode && state.hoverNode.id === node.id;
        const isSelected = state.selectedNode && state.selectedNode.id === node.id;
        const radius = node.radius + (isHover ? 4 : 0) + (isSelected ? 2 : 0);

        if (node.type === DEVICE_TYPE && node.isStreaming) {
            const time =
                Number.isFinite(state.animationTime) && state.animationTime > 0
                    ? state.animationTime
                    : typeof performance !== "undefined" && performance.now
                        ? performance.now()
                        : Date.now();
            const start =
                typeof node.streamingSince === "number" && Number.isFinite(node.streamingSince)
                    ? node.streamingSince
                    : time;
            const elapsed = Math.max(0, time - start);
            const period = DEVICE_STREAMING_PULSE_PERIOD || 2000;
            const phase = ((elapsed % period) / period) * Math.PI * 2;
            const pulse = (1 - Math.cos(phase)) * 0.5;
            const haloRadius = radius + DEVICE_STREAMING_HALO_OFFSET + pulse * DEVICE_STREAMING_HALO_RANGE;
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
            ctx.lineWidth = 2 + pulse * 2;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.22})`;
            ctx.shadowColor = `rgba(255, 255, 255, ${0.25 + pulse * 0.3})`;
            ctx.shadowBlur = 8 + pulse * 16;
            ctx.stroke();
            ctx.restore();
        }

        const gradient = ctx.createRadialGradient(node.x, node.y, radius * 0.1, node.x, node.y, radius);
        const isEmptyHub = node.type === HUB_TYPE && node.isEmptyHub;
        if (node.type === HUB_TYPE) {
            if (isEmptyHub) {
                gradient.addColorStop(0, "rgba(240, 245, 255, 0.5)");
                gradient.addColorStop(0.6, node.color);
                gradient.addColorStop(1, "rgba(88, 213, 255, 0.02)");
            } else {
                gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
                gradient.addColorStop(0.6, node.color);
                gradient.addColorStop(1, "rgba(88, 213, 255, 0.05)");
            }
        } else {
            gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
            gradient.addColorStop(0.6, node.color);
            gradient.addColorStop(1, "rgba(255, 110, 199, 0.05)");
        }

        ctx.save();
        if (isEmptyHub) {
            ctx.globalAlpha = 0.65;
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const labelOpacity =
            node.type === HUB_TYPE
                ? isEmptyHub
                    ? 0.45
                    : 0.85
                : 0.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
        ctx.font = "12px 'Inter', 'Noto Sans JP', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, node.x, node.y - radius - 12);
    });

    ctx.restore();
}

function updateDetailsPanel(node) {
    if (!node) {
        closeDetailsPanel();
        return;
    }
    closeConnectionPicker(true);

    detailsTitle.textContent = node.label;
    detailsId.textContent = node.id;
    detailsType.textContent = node.type === HUB_TYPE ? "ハブ" : "デバイス";

    if (node.type === DEVICE_TYPE) {
        hidePacketStream();
        state.activePacketHubId = null;
        if (state.activeDeviceId && state.activeDeviceId !== node.id) {
            const previousEntry = state.deviceStreams.get(state.activeDeviceId);
            if (previousEntry && previousEntry.socket) {
                try {
                    previousEntry.socket.close();
                } catch (error) {
                    console.warn("Failed to close previous device stream", error);
                }
                previousEntry.socket = null;
                previousEntry.status = "closed";
            }
        }
        state.activeDeviceId = node.id;
        state.deviceChatView = "chat";
        renderDeviceChat(node.id);
        subscribeToDeviceEvents(node.id);
        setHubDisplay(detailsHub, node.info.hubUuid);
        detailsHubRow.classList.remove("hidden");
        detailsConnectionsRow.classList.add("hidden");
        if (detailsActions) {
            detailsActions.classList.add("hidden");
        }
        if (deleteHubButton) {
            deleteHubButton.dataset.hubId = "";
            deleteHubButton.disabled = true;
        }
        if (connectionsSection) {
            connectionsSection.classList.add("hidden");
        }
        if (addConnectionButton) {
            addConnectionButton.disabled = true;
        }
        renderDeviceHubEditor(node);
    } else {
        hideDeviceChat();
        state.activePacketHubId = node.id;
        state.activeDeviceId = null;
        renderPacketStream(node.id);
        subscribeToHubPackets(node.id);
        detailsHubRow.classList.add("hidden");
        const connectionCount = node.info.connectedHubs.length + node.info.connectedDevices.length;
        detailsConnections.textContent = `${connectionCount} 接続`;
        detailsConnectionsRow.classList.remove("hidden");
        if (detailsActions) {
            detailsActions.classList.remove("hidden");
        }
        if (deleteHubButton) {
            deleteHubButton.dataset.hubId = node.id;
            deleteHubButton.disabled = false;
        }
        renderConnectionsSection(node);
        hideDeviceHubEditor();
    }

    detailsPanel.classList.remove("hidden");
    updateInfoPanelVisibility();
}

function renderConnectionsSection(node) {
    if (!connectionsSection || !connectionsList || !addConnectionButton) {
        return;
    }

    connectionsSection.classList.remove("hidden");
    connectionsList.innerHTML = "";

    if (!state.graph) {
        const placeholder = document.createElement("div");
        placeholder.className = "picker-empty";
        placeholder.textContent = "情報を取得できません";
        connectionsList.appendChild(placeholder);
        addConnectionButton.disabled = true;
        return;
    }

    const connected = node.info.connectedHubs || [];
    if (connected.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "picker-empty";
        placeholder.textContent = "まだハブに接続されていません";
        connectionsList.appendChild(placeholder);
    } else {
        connected.forEach((uuid) => {
            const hubNode = getHubNodeById(uuid);
            const displayName = hubNode ? hubNode.label : uuid;

            const chip = document.createElement("div");
            chip.className = "chip chip-with-action";
            chip.title = uuid;

            const chipLabel = document.createElement("span");
            chipLabel.className = "chip-label";
            chipLabel.textContent = displayName;
            chip.appendChild(chipLabel);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "chip-remove";
            removeButton.setAttribute("aria-label", `${displayName} との接続を解除`);
            removeButton.textContent = "×";
            removeButton.addEventListener("click", async (event) => {
                event.stopPropagation();
                const confirmed = window.confirm(`${displayName} との接続を解除しますか？`);
                if (!confirmed) {
                    return;
                }
                await disconnectHubs(node.id, uuid, removeButton);
            });
            chip.appendChild(removeButton);

            connectionsList.appendChild(chip);
        });
    }

    const availableCount = state.graph.nodes.filter(
        (other) =>
            other.type === HUB_TYPE &&
            other.id !== node.id &&
            !connected.includes(other.id),
    ).length;
    addConnectionButton.disabled = availableCount === 0;
}

function updateTooltip(node) {
    if (!node) {
        tooltip.classList.add("hidden");
        return;
    }
    tooltip.textContent = `${node.label} (${node.type === HUB_TYPE ? "Hub" : "Device"})`;
    tooltip.style.left = `${state.pointer.x}px`;
    tooltip.style.top = `${state.pointer.y}px`;
    tooltip.classList.remove("hidden");
}

function findNodeAtPosition(x, y) {
    if (!state.graph) {
        return null;
    }
    const nodes = state.graph.nodes;
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const node = nodes[i];
        const dx = x - node.x;
        const dy = y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= node.radius + 8) {
            return node;
        }
    }
    return null;
}

canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    state.hoverNode = findNodeAtPosition(x, y);
    updateTooltip(state.hoverNode);
});

canvas.addEventListener("mouseleave", () => {
    state.hoverNode = null;
    updateTooltip(null);
});

canvas.addEventListener("click", () => {
    state.selectedNode = state.hoverNode;
    updateDetailsPanel(state.selectedNode);
});

if (addConnectionButton) {
    addConnectionButton.addEventListener("click", () => {
        if (addConnectionButton.disabled) {
            return;
        }
        openConnectionPicker();
    });
}

if (deviceHubSelect) {
    deviceHubSelect.addEventListener("change", () => {
        updateDeviceHubSaveState();
    });
}

if (deviceHubSaveButton) {
    deviceHubSaveButton.addEventListener("click", async () => {
        if (!deviceHubEditor || !deviceHubSelect) {
            return;
        }
        const deviceId = deviceHubEditor.dataset.deviceId;
        const targetHubId = deviceHubSelect.value;
        if (!deviceId || !targetHubId || targetHubId === deviceHubEditor.dataset.currentHubId) {
            return;
        }
        await changeDeviceHub(deviceId, targetHubId);
    });
}

if (closeDetailsButton) {
    closeDetailsButton.addEventListener("click", () => {
        closeDetailsPanel();
    });
}

if (deleteHubButton) {
    deleteHubButton.addEventListener("click", async () => {
        const hubId = deleteHubButton.dataset.hubId;
        const baseUrl = getBaseUrl();
        if (!hubId || !baseUrl) {
            setStatus("削除できませんでした", "error");
            return;
        }

        const confirmed = window.confirm("このハブを削除しますか？");
        if (!confirmed) {
            return;
        }

        deleteHubButton.disabled = true;
        setStatus("削除中...", "loading");

        try {
            const response = await fetch(`${baseUrl}/hubs/${hubId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                let detail = "";
                try {
                    const errorData = await response.json();
                    if (errorData && typeof errorData.detail === "string") {
                        detail = errorData.detail;
                    }
                } catch (parseError) {
                    // ignore parse error
                }
                const message = detail ? `削除失敗: ${detail}` : "削除失敗";
                setStatus(message, "error");
                return;
            }

            closeDetailsPanel();
            const reloaded = await loadGraph({ silent: true });
            if (reloaded) {
                setStatus("ハブを削除しました", "idle");
            }
        } catch (error) {
            console.error("Failed to delete hub:", error);
            setStatus("削除失敗", "error");
        } finally {
            if (deleteHubButton) {
                deleteHubButton.disabled = !deleteHubButton.dataset.hubId;
            }
        }
    });
}

if (openCreateHubButton) {
    openCreateHubButton.addEventListener("click", () => {
        toggleDrawer("hub");
    });
}

if (openCreateAgentButton) {
    openCreateAgentButton.addEventListener("click", () => {
        if (state.activeDrawer === "agent" && state.isDrawerOpen) {
            toggleDrawer("agent");
            return;
        }
        updateAgentHubOptions();
        setAgentFormDefaults({ preserveHub: true });
        toggleDrawer("agent");
    });
}

if (closeDrawerButton) {
    closeDrawerButton.addEventListener("click", () => {
        setDrawerOpen(false, "hub");
        openCreateHubButton?.focus();
    });
}

if (closeAgentDrawerButton) {
    closeAgentDrawerButton.addEventListener("click", () => {
        setDrawerOpen(false, "agent");
        openCreateAgentButton?.focus();
    });
}

if (drawerBackdrop) {
    drawerBackdrop.addEventListener("click", () => {
        if (!state.activeDrawer) {
            return;
        }
        const active = state.activeDrawer;
        setDrawerOpen(false, active);
        if (active === "agent") {
            openCreateAgentButton?.focus();
        } else {
            openCreateHubButton?.focus();
        }
    });
}

if (connectionPicker) {
    connectionPicker.addEventListener("click", (event) => {
        if (event.target === connectionPicker) {
            closeConnectionPicker();
        }
    });
}

if (closePickerButton) {
    closePickerButton.addEventListener("click", () => {
        closeConnectionPicker();
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (state.isConnectionPickerOpen) {
            closeConnectionPicker();
            return;
        }
        if (state.isDrawerOpen) {
            const active = state.activeDrawer || "hub";
            setDrawerOpen(false, active);
            if (active === "agent") {
                openCreateAgentButton?.focus();
            } else {
                openCreateHubButton?.focus();
            }
        }
    }
});

refreshButton.addEventListener("click", async () => {
    const updated = await loadGraph();
    if (updated) {
        connectStateStream({ reset: true });
    }
});

if (createHubForm) {
    createHubForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const baseUrl = getBaseUrl();
        if (!baseUrl) {
            setStatus("APIエンドポイントを入力してください", "error");
            return;
        }

        const hubName = hubNameInput ? hubNameInput.value.trim() : "";
        if (!hubName) {
            setStatus("ハブ名を入力してください", "error");
            if (hubNameInput) {
                hubNameInput.focus();
            }
            return;
        }

        if (createHubButton) {
            createHubButton.disabled = true;
        }
        setStatus("ハブ作成中...", "loading");

        try {
            const response = await fetch(`${baseUrl}/hubs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: hubName }),
            });

            if (!response.ok) {
                let detail = "";
                try {
                    const errorData = await response.json();
                    if (errorData && typeof errorData.detail === "string") {
                        detail = errorData.detail;
                    }
                } catch (parseError) {
                    // ignore parse error
                }
                const message = detail ? `追加失敗: ${detail}` : "追加失敗";
                setStatus(message, "error");
                if (hubNameInput) {
                    hubNameInput.focus();
                }
                return;
            }

            if (hubNameInput) {
                hubNameInput.value = "";
            }
            const reloaded = await loadGraph({ silent: true });
            if (reloaded) {
                setStatus("ハブを追加しました", "idle");
                setDrawerOpen(false, "hub");
                openCreateHubButton?.focus();
            }
        } catch (error) {
            console.error("Failed to create hub:", error);
            setStatus("追加失敗", "error");
        } finally {
            if (createHubButton) {
                createHubButton.disabled = false;
            }
        }
    });
}

if (createAgentForm) {
    createAgentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const baseUrl = getBaseUrl();
        if (!baseUrl) {
            setStatus("APIエンドポイントを入力してください", "error");
            return;
        }

        const agentName = agentNameInput ? agentNameInput.value.trim() : "";
        if (!agentName) {
            setStatus("エージェント名を入力してください", "error");
            if (agentNameInput) {
                agentNameInput.focus();
            }
            return;
        }

        const payload = {
            name: agentName,
            model:
                agentModelInput && agentModelInput.value.trim()
                    ? agentModelInput.value.trim()
                    : DEFAULT_AGENT_CONFIG.model,
            situation: agentSituationInput ? agentSituationInput.value.trim() : DEFAULT_AGENT_CONFIG.situation,
            runAI: agentRunAICheckbox ? agentRunAICheckbox.checked : DEFAULT_AGENT_CONFIG.runAI,
            isReasoning: agentReasoningCheckbox ? agentReasoningCheckbox.checked : DEFAULT_AGENT_CONFIG.isReasoning,
            debug: agentDebugCheckbox ? agentDebugCheckbox.checked : DEFAULT_AGENT_CONFIG.debug,
        };

        const coolTimeValue = Math.max(0, getNumberFromInput(agentCoolTimeInput, DEFAULT_AGENT_CONFIG.coolTime));
        const timeoutValue = Math.max(0, getNumberFromInput(agentTimeoutInput, DEFAULT_AGENT_CONFIG.timeOut));
        payload.coolTime = coolTimeValue;
        payload.timeOut = timeoutValue;

        if (!agentHubSelect || agentHubSelect.disabled || !agentHubSelect.value) {
            setStatus("接続するハブを選択してください", "error");
            agentHubSelect?.focus();
            return;
        }
        payload.hubUuid = agentHubSelect.value;

        if (createAgentButton) {
            createAgentButton.disabled = true;
            createAgentButton.dataset.submitting = "true";
        }
        setStatus("エージェント作成中...", "loading");

        try {
            const response = await fetch(`${baseUrl}/devices`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let detail = "";
                try {
                    const errorData = await response.json();
                    if (errorData && typeof errorData.detail === "string") {
                        detail = errorData.detail;
                    }
                } catch (parseError) {
                    // ignore parse error
                }
                const message = detail ? `追加失敗: ${detail}` : "追加失敗";
                setStatus(message, "error");
                if (agentNameInput) {
                    agentNameInput.focus();
                }
                return;
            }

            persistAgentFormCache({
                model: payload.model,
                situation: payload.situation,
                runAI: payload.runAI,
                isReasoning: payload.isReasoning,
                debug: payload.debug,
                coolTime: payload.coolTime,
                timeOut: payload.timeOut,
                hubUuid: payload.hubUuid,
            });

            setAgentFormDefaults({ preserveHub: true });
            const reloaded = await loadGraph({ silent: true });
            if (reloaded) {
                setStatus("エージェントを追加しました", "idle");
                setDrawerOpen(false, "agent");
                openCreateAgentButton?.focus();
            }
        } catch (error) {
            console.error("Failed to create agent:", error);
            setStatus("追加失敗", "error");
        } finally {
            if (createAgentButton) {
                delete createAgentButton.dataset.submitting;
                if (!createAgentButton.dataset.disabledByHub) {
                    createAgentButton.disabled = false;
                }
            }
        }
    });
}

window.addEventListener("resize", () => {
    resizeCanvas();
});

async function loadGraph({ silent = false } = {}) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        setStatus("APIエンドポイントを入力してください", "error");
        return false;
    }
    if (!silent) {
        setStatus("読込中...", "loading");
        tooltip.classList.add("hidden");
        hidePacketStream();
        detailsPanel.classList.add("hidden");
        state.selectedNode = null;
        state.hoverNode = null;
        updateInfoPanelVisibility();
    }

    try {
        const [hubsResponse, devicesResponse] = await Promise.all([
            fetch(`${baseUrl}/hubs`),
            fetch(`${baseUrl}/devices`),
        ]);

        if (!hubsResponse.ok || !devicesResponse.ok) {
            throw new Error("API response was not OK");
        }

        const hubs = await hubsResponse.json();
        const devices = await devicesResponse.json();

        return applyGraphUpdate(hubs, devices, { silent });
    } catch (error) {
        console.error("Failed to fetch graph data:", error);
        setStatus("取得エラー", "error");
        return false;
    }
}

function animate(timestamp) {
    state.animationTime = Number.isFinite(timestamp) ? timestamp : state.animationTime;
    updatePacketAnimations(timestamp);
    if (state.graph) {
        simulate(state.graph);
        draw(state.graph);
    }
    requestAnimationFrame(animate);
}

resizeCanvas();
loadGraph().then((success) => {
    if (success) {
        connectStateStream();
    }
});
requestAnimationFrame(animate);
