// PeerManager.js
import { eventHub } from "./EventHub.js";

export class PeerManager {
  constructor() {
    if (PeerManager.instance) {
      return PeerManager.instance;
    }

    this.peer = null; // Main Peer instance
    this.connections = []; // Active connections
    this.nickname = ""; // User's nickname
    this.nicknames = {}; // Nicknames of connected peers

    PeerManager.instance = this;
  }

  /**
   * Initialize the peer connection.
   * Attempts to host the room first. If it fails, connects to the room as a visitor.
   */
  initializePeer({ roomName, nickname = "" }) {
    console.assert(
      !this.peer,
      "Peer already initialized. Cannot initialize again."
    );

    this.nickname = nickname;

    // Attempt to host the room
    this.peer = new Peer(roomName);


    //If the name is available, we are the host
    this.peer.on("open", (id) => {
      console.log(`Hosting room "${roomName}". Your ID: ${id}`);
      eventHub.emit("update-status-display", `Room created. Your ID: ${id}`);
      addMessage(`You are hosting the chat room as "${this.nickname}".`);

      this.peer.on("connection", (conn) => {
        console.log("Player connected:", conn.peer);
        eventHub.emit(
          "update-status-display",
          "Player connected: " + conn.peer
        );
        this.setupConnection(conn);

       
      });
    });

    // If the room is already taken, join as a visitor
    this.peer.on("error", (err) => {
      if (err.type === "peer-unavailable" || err.message.includes("taken")) {
        this.joinRoom(roomName);
      } else {
        console.error("Peer setup Error:", err);
      }
    });
  }

  /**
   * Join an existing room.
   */
  joinRoom(roomName) {
    this.peer = new Peer(); // Create a new peer without specifying an ID

    this.peer.on("open", (id) => {
    

      // Connect to the existing room
      const conn = this.peer.connect(roomName);
      this.setupConnection(conn);

      conn.on("open", () => {
          eventHub.emit(
            "update-status-display",
            `Joined room "${roomName}" as "${this.nickname}".`
          );

      });
    });

    this.peer.on("error", (err) => {
      console.error("Error joining room:", err);
    });
  }

  /**
   * Set up a connection with another peer.
   */
  setupConnection(conn) {
    if (!conn._handled) {
      conn._handled = true;
    } else {
      return;
    }

    this.connections.push(conn);

    conn.on("data", (data) => {
      handlePeerMessage(data, conn);
    });

    conn.on("close", () => {
      this.connections = this.connections.filter((c) => c !== conn);
      eventHub.emit(
        "update-status-display",
        `Player disconnected: ${conn.peer}`
      );
    });

    conn.on("error", (err) => {
      console.error("Connection error with", conn.peer, ":", err);
    });

    conn.on("open", () => {
      // Send the nickname to the room
      conn.send({
        type: "nickname",
        nickname: this.nickname,
      });
      addMessage(`User "${this.nickname}" has joined the chat.`);
    });
  }

  /**
   * Broadcast a message to all connected peers.
   */
  broadcast(message) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }
}

export const peerManager = new PeerManager();

// DOM Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const connectionKeyInput = document.getElementById("connection-key");
  const statusDisplay = document.getElementById("connection-status");
  const messageInput = document.getElementById("message-input");
  

  // Handle room connection
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

  // Handle sending messages
  function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      // Display the message in the user's chatbox
      addMessage(`You: ${message}`, "self-message");

      // Broadcast the message to all connected peers
      peerManager.broadcast({
        type: "message",
        sender: peerManager.nickname,
        message: message,
      });

      // Clear the input field
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

  // Update the status display dynamically
  eventHub.on("update-status-display", (message) => {
    statusDisplay.textContent = message;
  });
});

/**
 * Sanitize input to prevent invalid characters.
 */
function sanitize(name) {
  // Remove leading/trailing whitespace and restrict to alphanumeric and specific characters
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
}

/**
 * Add a message to the chat interface.
 */
function addMessage(message, messageType = "notification-message") {
  const chatMessages = document.getElementById("chat-messages");
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  messageElement.className = `chat-message ${messageType}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Handle incoming messages from peers.
 */
function handlePeerMessage(data, conn) {
  switch (data.type) {
    case "message":
      addMessage(`${data.sender}: ${data.message}`, "other-message");
      break;
    case "notification":
      addMessage(`* ${data.message}`, "notification-message");
      break;
    case "nickname":
      addMessage(
        `* User "${data.nickname}" is now known.`,
        "notification-message"
      );
      peerManager.nicknames[conn.peer] = data.nickname;
      break;
    default:
      eventHub.emit(data.type, data); // Forward rest of messages to Game.js like game reset
      return;
  }
}
