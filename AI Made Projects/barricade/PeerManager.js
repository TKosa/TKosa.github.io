import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { eventHub } from "./EventHub.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./SupabaseConfig.js";

const ROOM_PREFIX = "barricade:";
const LAST_ROOM_KEY = "barricade:lastRoom";
const LAST_NICK_KEY = "barricade:lastNick";

export class PeerManager {
  constructor() {
    if (PeerManager.instance) {
      return PeerManager.instance;
    }

    this.nickname = "";
    this.nicknames = {};
    this.currentRoomName = "";
    this.clientId = crypto.randomUUID();
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.channel = null;
    this.connected = false;
    this.lastSeenMessageId = 0;
    this.seenMessageIds = new Set();
    this.pollTimer = null;
    this.participants = new Map();
    this.isHost = false;
    this.lastRoomStateUpdatedAt = null;

    PeerManager.instance = this;
  }

  get connections() {
    const ids = this.getParticipantIds().filter((id) => id !== this.clientId);
    return ids.map((peer) => ({ peer, open: true }));
  }

  async initializePeer({ roomName, nickname = "" }) {
    if (this.channel) {
      await this.teardownPeer("reinitialize");
    }

    this.nickname = nickname || "Guest";
    this.currentRoomName = roomName;
    localStorage.setItem(LAST_ROOM_KEY, roomName);
    localStorage.setItem(LAST_NICK_KEY, this.nickname);
    this.lastSeenMessageId = 0;
    this.seenMessageIds.clear();
    this.participants.clear();
    this.lastRoomStateUpdatedAt = null;

    const channelName = `room-${ROOM_PREFIX}${roomName}`;
    this.channel = this.supabase.channel(channelName, {
      config: { presence: { key: this.clientId } },
    });

    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState();
      this.participants.clear();
      Object.entries(state).forEach(([id, metas]) => {
        const meta = Array.isArray(metas) && metas.length > 0 ? metas[0] : {};
        this.participants.set(id, {
          nickname: meta.nickname || "Guest",
        });
      });
      const ordered = this.getParticipantIds();
      this.isHost = ordered.length > 0 && ordered[0] === this.clientId;
      eventHub.emit("participants-updated", {
        ids: ordered,
        count: ordered.length,
        isHost: this.isHost,
      });
    });

    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        this.connected = true;
        await this.channel.track({ nickname: this.nickname });
        eventHub.emit(
          "update-status-display",
          `Connected to relay room "${roomName}" as "${this.nickname}".`
        );
        this.broadcast({ type: "nickname", nickname: this.nickname });
        this.syncLastSeenMessageId();
        this.startMessagePolling();
        this.loadRoomState();
        eventHub.emit("relay-connected", { roomName, nickname: this.nickname });
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        this.connected = false;
        eventHub.emit(
          "update-status-display",
          "Relay connection interrupted. Reconnecting..."
        );
        this.startMessagePolling();
      }
    });
  }

  async teardownPeer(reason = "manual") {
    this.connected = false;
    this.stopMessagePolling();
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch (_err) {
        // Ignore untrack errors during teardown.
      }
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.participants.clear();
    this.currentRoomName = "";
    this.isHost = false;
    eventHub.emit("participants-updated", { ids: [], count: 0, isHost: false });
  }

  async leaveRoom() {
    await this.teardownPeer("leave-room");
    localStorage.removeItem(LAST_ROOM_KEY);
    localStorage.removeItem(LAST_NICK_KEY);
  }

  isConnected() {
    return this.connected;
  }

  getParticipantCount() {
    return this.getParticipantIds().length;
  }

  getParticipantIds() {
    return Array.from(this.participants.keys()).sort();
  }

  async broadcast(message) {
    if (!this.connected || !this.currentRoomName) {
      return;
    }
    const payload = {
      room: `${ROOM_PREFIX}${this.currentRoomName}`,
      sender: this.clientId,
      type: message.type || "message",
      payload: message,
    };
    const { error } = await this.supabase.from("room_messages").insert(payload);
    if (error) {
      console.error("Relay insert error:", error);
      eventHub.emit("update-status-display", "Relay send failed.");
    }
  }

  async syncLastSeenMessageId() {
    if (!this.currentRoomName) {
      return;
    }
    const { data } = await this.supabase
      .from("room_messages")
      .select("id")
      .eq("room", `${ROOM_PREFIX}${this.currentRoomName}`)
      .order("id", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      this.lastSeenMessageId = Math.max(this.lastSeenMessageId, Number(data[0].id) || 0);
    }
  }

  async saveRoomState(state) {
    if (!this.connected || !this.currentRoomName) {
      return;
    }
    const payload = {
      room: `${ROOM_PREFIX}${this.currentRoomName}`,
      state,
      updated_by: this.clientId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from("room_state").upsert(payload, {
      onConflict: "room",
    });
    if (error) {
      console.error("Relay state save error:", error);
    }
  }

  async loadRoomState() {
    if (!this.currentRoomName) {
      return;
    }
    const { data, error } = await this.supabase
      .from("room_state")
      .select("state,updated_at")
      .eq("room", `${ROOM_PREFIX}${this.currentRoomName}`)
      .maybeSingle();
    if (error || !data || !data.state) {
      return;
    }
    this.lastRoomStateUpdatedAt = data.updated_at || this.lastRoomStateUpdatedAt;
    eventHub.emit("room-state-loaded", data.state);
  }

  startMessagePolling() {
    if (this.pollTimer || !this.currentRoomName) {
      return;
    }
    this.pollTimer = setInterval(() => {
      this.pollMessages();
    }, 1000);
  }

  stopMessagePolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollMessages() {
    if (!this.currentRoomName) {
      return;
    }
    const { data, error } = await this.supabase
      .from("room_messages")
      .select("id,sender,payload")
      .eq("room", `${ROOM_PREFIX}${this.currentRoomName}`)
      .gt("id", this.lastSeenMessageId)
      .order("id", { ascending: true })
      .limit(100);

    if (error || !data) {
      return;
    }

    for (const row of data) {
      if (!row.id || this.seenMessageIds.has(row.id)) {
        continue;
      }
      this.seenMessageIds.add(row.id);
      this.lastSeenMessageId = Math.max(this.lastSeenMessageId, Number(row.id) || 0);
      if (row.sender === this.clientId || !row.payload) {
        continue;
      }
      handlePeerMessage(row.payload, { peer: row.sender });
    }

    await this.pollRoomState();
  }

  async pollRoomState() {
    if (!this.currentRoomName) {
      return;
    }
    const { data, error } = await this.supabase
      .from("room_state")
      .select("state,updated_at")
      .eq("room", `${ROOM_PREFIX}${this.currentRoomName}`)
      .maybeSingle();
    if (error || !data || !data.state) {
      return;
    }
    if (!this.lastRoomStateUpdatedAt || data.updated_at > this.lastRoomStateUpdatedAt) {
      this.lastRoomStateUpdatedAt = data.updated_at;
      eventHub.emit("room-state-loaded", data.state);
    }
  }
}

export const peerManager = new PeerManager();

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const connectionKeyInput = document.getElementById("connection-key");
  const statusDisplay = document.getElementById("connection-status");
  const leaveBtn = document.getElementById("leave-btn");
  const messageInput = document.getElementById("message-input");

  connectBtn.addEventListener("click", () => {
    const roomName = sanitize(connectionKeyInput.value);
    const nickname = sanitize(document.getElementById("nickname-field").value) || "Guest";

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    statusDisplay.textContent = "Connecting to room: " + roomName;
    peerManager.initializePeer({ roomName, nickname });
  });

  const savedRoom = localStorage.getItem(LAST_ROOM_KEY) || "";
  const savedNick = localStorage.getItem(LAST_NICK_KEY) || "";
  if (savedRoom) {
    connectionKeyInput.value = savedRoom;
  }
  if (savedNick) {
    const nickInput = document.getElementById("nickname-field");
    if (nickInput) {
      nickInput.value = savedNick;
    }
  }
  if (savedRoom) {
    statusDisplay.textContent = "Reconnecting to room: " + savedRoom;
    peerManager.initializePeer({ roomName: savedRoom, nickname: savedNick || "Guest" });
  }

  function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      addMessage(`You: ${message}`, "self-message");
      peerManager.broadcast({
        type: "message",
        sender: peerManager.nickname,
        message,
      });
      messageInput.value = "";
    }
  }

  const sendButton = document.getElementById("send-button");
  sendButton.addEventListener("click", handleSendMessage);

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  });

  eventHub.on("update-status-display", (message) => {
    statusDisplay.textContent = message;
  });

  leaveBtn.addEventListener("click", async () => {
    await peerManager.leaveRoom();
    connectionKeyInput.value = "";
    statusDisplay.textContent = "Disconnected. Room cleared.";
  });
});

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
}

function addMessage(message, messageType = "notification-message") {
  const chatMessages = document.getElementById("chat-messages");
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  messageElement.className = `chat-message ${messageType}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handlePeerMessage(data, conn) {
  switch (data.type) {
    case "message":
      addMessage(`${data.sender}: ${data.message}`, "other-message");
      break;
    case "nickname":
      addMessage(`* User "${data.nickname}" is now known.`, "notification-message");
      peerManager.nicknames[conn.peer] = data.nickname;
      break;
    default:
      eventHub.emit(data.type, { ...data, _senderPeer: conn.peer });
      return;
  }
}
