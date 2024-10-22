import { peerManager } from './PeerManager.js';

let userNickname = 'Anonymous'; // Default nickname
let nicknames = {}; // PeerId -> Nickname

document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  const hostButton = document.getElementById('host-button');
  const joinButton = document.getElementById('join-button');
  const modal = document.getElementById('join-modal');
  const closeModal = document.getElementById('close-modal');
  const confirmJoin = document.getElementById('confirm-join');
  const joinRoomNameInput = document.getElementById('join-room-name');

  

  function hostRoom() {
    const nickname = sanitizeNickname(prompt("Enter your nickname:"));
    if (!nickname) {
      alert('Nickname is required to host a room.');
      return;
    }
    userNickname = nickname;

    const roomName = sanitizeRoomName(prompt('Enter a unique name for your room (optional):') || '');
    let peer = peerManager.initializePeer(roomName);
    peer.on("open", (id) => {
      addMessage(`You are hosting the chat room as "${userNickname}".`);
      addMessage(`Your Room ID (share this with others to join): ${id}`);
    });

    peer.on("connection", (conn) => {
      conn.on("open", () => {
        conn.send({ type: "nickname", nickname: userNickname });
        setupConnectionListeners(conn);
      });
    });

  }

  function joinRoom(roomName, nickname) {
    if (!(peerManager.peer)) {
      let peer = peerManager.initializePeer();

      peer.on("open", () => {
        joinRoom(roomName, nickname);
      });
      return;
    } 
    userNickname = nickname;
    let conn = peerManager.connect(roomName);
    conn.on("open", () => {
      addMessage(`You joined the chat room as "${userNickname}".`);
      conn.send({ type: "nickname", nickname: userNickname });
      setupConnectionListeners(conn);
      closeJoinModal();
    });
  }

  function setupConnectionListeners(conn) {
    if (!conn._handled) {
      conn.handled = true;
    } else {
      return;
    }
    conn.on("data", (data) => {
      handlePeerMessage(data, conn);
    });
    conn.on("close", () => {
      addMessage(`User "${nicknames[conn]}" has left the chat.`);
      delete nicknames[conn];
    });
  }

  function handlePeerMessage(data, conn) {
    switch (data.type) {
      case 'message':
        addMessage(`${data.sender}: ${data.message}`, 'other-message');
        break;
      case 'notification':
        addMessage(`* ${data.message}`, 'notification-message');
        break;
      case 'nickname':
        addMessage(`* User "${data.nickname}" is now known.`, 'notification-message');
        nicknames[conn] = data.nickname;
        break;
      default:
        return;
    }
  }

  function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      addMessage(`You: ${message}`, 'self-message');
      peerManager.broadcast({ type: 'message', sender: userNickname, message: message });
      messageInput.value = '';
    }
  }

  // Event listeners
  hostButton.addEventListener('click', hostRoom);

  joinButton.addEventListener('click', () => {
    modal.style.display = 'block';
    clearJoinError(); // Clear any previous error messages when opening the modal
  });

  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
    clearJoinError(); // Clear any error messages when closing the modal
  });

  confirmJoin.addEventListener('click', () => {
    const roomName = joinRoomNameInput.value.trim();
    const nicknameInput = document.getElementById('join-nickname');
    const nickname = sanitizeNickname(nicknameInput.value.trim());

    if (roomName && nickname) {
      joinRoom(roomName, nickname);
    } else {
      displayJoinError("Please enter both Room ID and Nickname.");
    }
  });

  sendButton.addEventListener('click', handleSendMessage);

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });

  // Helper functions to manage the modal and error messages
  function closeJoinModal() {
    modal.style.display = 'none';
    clearJoinError();
  }

  function displayJoinError(message) {
    const errorElement = document.getElementById('join-error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  function clearJoinError() {
    const errorElement = document.getElementById('join-error-message');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }
  }

  function sanitizeRoomName(roomName) {
    // Example: Remove spaces and special characters
    return roomName.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function sanitizeNickname(nickname) {
    // Remove leading/trailing whitespace and restrict to alphanumeric and specific characters
    return nickname.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Anonymous';
  }

  // Function to add a message to the chat
  function addMessage(message, messageType = 'notification-message') {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = `chat-message ${messageType}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }



});