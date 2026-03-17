import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { eventHub } from "./EventHub.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./SupabaseConfig.js";

const BUILD_TAG = "relay-20260316a";
const LAST_ROOM_KEY = "relay:lastRoom";
const LAST_NICK_KEY = "relay:lastNick";

export class PeerManager {
  constructor() {
    if (PeerManager.instance) {
      return PeerManager.instance;
    }

    this.connections = [];
    this.nickname = "";
    this.nicknames = {};
    this.currentRoomName = "";
    this.sessionId = makeSessionId();
    this.clientId = crypto.randomUUID();
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.channel = null;
    this.connected = false;

    PeerManager.instance = this;
  }

  async initializePeer({ roomName, nickname = "" }) {
    if (this.channel) {
      await this.teardownPeer("reinitialize");
    }

    this.nickname = nickname || "Guest";
    this.currentRoomName = roomName;
    localStorage.setItem(LAST_ROOM_KEY, roomName);
    localStorage.setItem(LAST_NICK_KEY, this.nickname);
    dbg(this.sessionId, "initializeRelay", { roomName, nickname: this.nickname });

    const channelName = `room-${roomName}`;
    this.channel = this.supabase.channel(channelName);

    this.channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "room_messages",
        filter: `room=eq.${roomName}`,
      },
      (payload) => {
        const row = payload.new || {};
        if (!row.payload || row.sender === this.clientId) {
          return;
        }
        handlePeerMessage(row.payload, { peer: row.sender });
      }
    );

    this.channel.subscribe((status) => {
      dbg(this.sessionId, "relay channel status", { status, channelName });
      if (status === "SUBSCRIBED") {
        this.connected = true;
        eventHub.emit(
          "update-status-display",
          `Connected to relay room "${roomName}" as "${this.nickname}".`
        );
        this.broadcast({ type: "nickname", nickname: this.nickname });
        eventHub.emit("relay-connected", { roomName, nickname: this.nickname });
        this.loadRoomState();
      }
    });
  }

  async teardownPeer(reason = "manual") {
    dbg(this.sessionId, "teardownRelay", { reason });
    this.connected = false;
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  isConnected() {
    return this.connected;
  }

  async broadcast(message) {
    if (!this.connected || !this.currentRoomName) {
      return;
    }
    const payload = {
      room: this.currentRoomName,
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

  async saveRoomState(state) {
    if (!this.connected || !this.currentRoomName) {
      return;
    }
    const payload = {
      room: this.currentRoomName,
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
      .select("state, updated_at")
      .eq("room", this.currentRoomName)
      .maybeSingle();
    if (error) {
      console.error("Relay state load error:", error);
      return;
    }
    if (!data || !data.state) {
      return;
    }
    eventHub.emit("room-state-loaded", data.state);
  }
}

export const peerManager = new PeerManager();

document.addEventListener("DOMContentLoaded", () => {
  console.log("[P2P BUILD]", BUILD_TAG, "mode=supabase-relay");
  const connectBtn = document.getElementById("connect-btn");
  const connectionKeyInput = document.getElementById("connection-key");
  const statusDisplay = document.getElementById("connection-status");
  const messageInput = document.getElementById("message-input");

  connectBtn.addEventListener("click", () => {
    const roomName = sanitize(connectionKeyInput.value);
    const nickname =
      sanitize(document.getElementById("nickname-field").value) || "Guest";

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
        message: message,
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

  window.addEventListener("beforeunload", () => {
    peerManager.teardownPeer("beforeunload");
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
    case "notification":
      addMessage(`* ${data.message}`, "notification-message");
      break;
    case "nickname":
      addMessage(`* User "${data.nickname}" is now known.`, "notification-message");
      peerManager.nicknames[conn.peer] = data.nickname;
      break;
    default:
      eventHub.emit(data.type, data);
      return;
  }
}

function dbg(sessionId, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = `[P2P ${ts}][${sessionId}] ${message}`;
  if (data) {
    console.log(prefix, data);
    return;
  }
  console.log(prefix);
}

function makeSessionId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
