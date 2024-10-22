// PeerManager.js
import { eventHub } from './EventHub.js';

export class PeerManager {
  constructor() {
    if (PeerManager.instance) {
      return PeerManager.instance;
    }

    this.peer = null;
    this.connections = [];

    PeerManager.instance = this;
  }

  initializePeer(id) {
    if (this.peer) {
      console.warn('PeerJS is already initialized.');
      return;
    }

    this.peer = id ? new Peer(id) : new Peer();

    this.peer.on('open', (id) => {
      console.log('Peer ID:', id);
    });

    this.peer.on('connection', (conn) => {
      this.connections.push(conn);
       conn.on("close", () => {
         this.connections = this.connections.filter((c) => c !== conn);
       });
       conn.on("error", console.error);
    });

    this.peer.on('error', console.error);

    return this.peer;
  }

  // Assumes peer is already open
  connect(peerId) {
    // If peer is not initialized, initialize it and try to connect again
    if (!(this.peer)) {
      let peer = this.initializePeer();
      peer.on("open", () => {
        this.connect(peerId);
      });
      return;
    }

    const conn = this.peer.connect(peerId);
    this.connections.push(conn);
     conn.on("close", () => {
       this.connections = this.connections.filter((c) => c !== conn);
     });
    conn.on("error", console.error);
    conn.on("data", (data) => {
      if (data.type === "start-game") {
        eventHub.emit("start-game", data);
      }

      if (data.type === "reset-by-host") {
        eventHub.emit("reset-by-host");
      }
    });
    return conn;
  }


  broadcast(message) {
    Object.values(this.connections).forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }
}

export const peerManager = new PeerManager();
