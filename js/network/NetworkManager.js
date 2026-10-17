/**
 * NetworkManager - Main network coordination using WebRTC + PeerJS-style signaling
 * Uses a public signaling server for WebRTC setup, then P2P data channels
 */
class NetworkManager {
    constructor() {
        this.isHost = false;
        this.isClient = false;
        this.roomId = null;
        this.roomName = 'TURRINI ROOM';
        this.maxPlayers = 4;
        this.playerId = null;
        this.players = new Map();
        this.peers = new Map(); // peer connections
        this.dataChannels = new Map();
        this.discoveryInterval = null;
        this.connected = false;
        this.tickRate = 20; // Network ticks per second
        this.lastTick = 0;
        this.listeners = {};
        
        // Public PeerJS-style signaling (uses free cloud server)
        this.signalingUrl = 'wss://peerjs-server.herokuapp.com';
        this.peer = null;
    }

    /**
     * Create a host room
     */
    async createHost() {
        return ErrorHandler.safeAsync(async () => {
            this.isHost = true;
            this.isClient = false;
            this.playerId = this.generatePlayerId();
            this.roomId = this.generateRoomId();
            
            // Initialize WebRTC peer as host
            await this.initPeer(this.roomId);
            
            this.players.set(this.playerId, {
                id: this.playerId,
                name: 'HOST',
                isHost: true,
                connected: true,
                vehicle: null,
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1]
            });

            console.log(`Host created: ${this.roomName} (${this.roomId})`);
            
            return {
                roomName: this.roomName,
                roomId: this.roomId,
                players: this.players.size,
                maxPlayers: this.maxPlayers
            };
        }, 'NetworkManager.createHost');
    }

    /**
     * Initialize WebRTC peer connection
     */
    async initPeer(peerId) {
        return new Promise((resolve, reject) => {
            try {
                // Use simple PeerJS-like implementation
                this.peer = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                });

                this.peer.onicecandidate = (e) => {
                    if (e.candidate) {
                        this.broadcastICE(e.candidate);
                    }
                };

                this.peer.ondatachannel = (e) => {
                    this.handleDataChannel(e.channel);
                };

                this.peer.onconnectionstatechange = () => {
                    console.log('Peer state:', this.peer.connectionState);
                    if (this.peer.connectionState === 'connected') {
                        this.connected = true;
                        this.emit('connected');
                    }
                };

                // Create main data channel if host
                if (this.isHost) {
                    const channel = this.peer.createDataChannel('game', {
                        ordered: false,
                        maxRetransmits: 0
                    });
                    this.handleDataChannel(channel);
                }

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Handle incoming data channel
     */
    handleDataChannel(channel) {
        channel.binaryType = 'arraybuffer';
        
        channel.onopen = () => {
            console.log('Data channel opened:', channel.label);
            this.dataChannels.set(channel.label, channel);
        };

        channel.onmessage = (e) => {
            this.handleMessage(e.data);
        };

        channel.onclose = () => {
            this.dataChannels.delete(channel.label);
        };
    }

    /**
     * Start discovering rooms on LAN
     */
    async startDiscovery(callback) {
        // In a browser environment without native LAN discovery,
        // we use a shared signaling approach via localStorage + BroadcastChannel
        // for same-device testing, or a simple room code system
        
        this.discoveryInterval = setInterval(() => {
            // Query available rooms from signaling
            const rooms = this.getAvailableRooms();
            if (callback) callback(rooms);
        }, 2000);

        // Initial query
        setTimeout(() => {
            const rooms = this.getAvailableRooms();
            if (callback) callback(rooms);
        }, 500);
    }

    /**
     * Stop discovery
     */
    stopDiscovery() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
    }

    /**
     * Get available rooms (simulated for browser env)
     */
    getAvailableRooms() {
        // In real implementation, this would query a signaling server
        // For now, return rooms from localStorage (for testing)
        try {
            const rooms = JSON.parse(localStorage.getItem('game_rooms') || '[]');
            // Filter out old rooms (> 5 minutes)
            const now = Date.now();
            return rooms.filter(r => now - r.createdAt < 300000);
        } catch (e) {
            return [];
        }
    }

    /**
     * Register this room for discovery
     */
    registerRoom() {
        try {
            let rooms = JSON.parse(localStorage.getItem('game_rooms') || '[]');
            rooms = rooms.filter(r => r.id !== this.roomId);
            rooms.push({
                id: this.roomId,
                name: this.roomName,
                players: this.players.size,
                maxPlayers: this.maxPlayers,
                hostId: this.playerId,
                createdAt: Date.now()
            });
            localStorage.setItem('game_rooms', JSON.stringify(rooms));
        } catch (e) {
            console.warn('Failed to register room:', e);
        }
    }

    /**
     * Join an existing room
     */
    async joinRoom(roomId) {
        return ErrorHandler.safeAsync(async () => {
            this.isHost = false;
            this.isClient = true;
            this.roomId = roomId;
            this.playerId = this.generatePlayerId();

            // Initialize peer as client
            await this.initPeer(this.playerId);

            // Connect to host
            const connected = await this.connectToHost(roomId);
            
            if (connected) {
                this.connected = true;
                this.emit('joined', { roomId, playerId: this.playerId });
                return true;
            }
            
            return false;
        }, 'NetworkManager.joinRoom');
    }

    /**
     * Connect to host via WebRTC
     */
    async connectToHost(hostId) {
        return new Promise((resolve) => {
            try {
                // Create offer and send to host via signaling
                const offer = this.peer.createDataChannel('game');
                this.handleDataChannel(offer);
                
                // In real implementation, exchange SDP via signaling server
                // For now, use BroadcastChannel for same-origin signaling
                const bc = new BroadcastChannel('game_signaling');
                bc.postMessage({
                    type: 'join-request',
                    roomId: hostId,
                    playerId: this.playerId,
                    timestamp: Date.now()
                });

                bc.onmessage = (e) => {
                    if (e.data.type === 'join-accepted' && e.data.roomId === hostId) {
                        bc.close();
                        resolve(true);
                    }
                };

                // Timeout after 5 seconds
                setTimeout(() => resolve(false), 5000);
            } catch (e) {
                console.error('Connection failed:', e);
                resolve(false);
            }
        });
    }

    /**
     * Handle incoming network message
     */
    handleMessage(data) {
        try {
            let message;
            if (data instanceof ArrayBuffer) {
                message = this.decodeBinaryMessage(data);
            } else {
                message = JSON.parse(data);
            }

            switch (message.type) {
                case 'state':
                    this.handleStateUpdate(message);
                    break;
                case 'player_joined':
                    this.handlePlayerJoined(message);
                    break;
                case 'player_left':
                    this.handlePlayerLeft(message);
                    break;
                case 'chat':
                    this.handleChat(message);
                    break;
                case 'mod_request':
                    this.handleModRequest(message);
                    break;
            }

            this.emit('message', message);
        } catch (e) {
            console.warn('Failed to handle message:', e);
        }
    }

    /**
     * Handle state update from another player
     */
    handleStateUpdate(message) {
        if (window.SyncManager) {
            window.SyncManager.applyRemoteState(message.playerId, message.state);
        }
    }

    handlePlayerJoined(message) {
        this.players.set(message.playerId, {
            id: message.playerId,
            name: message.name,
            connected: true,
            vehicle: null
        });
        this.emit('playerJoined', message);
    }

    handlePlayerLeft(message) {
        this.players.delete(message.playerId);
        this.emit('playerLeft', message);
    }

    handleChat(message) {
        this.emit('chat', message);
    }

    handleModRequest(message) {
        // Check if we have the requested mod
        if (window.ModManager) {
            const hasMod = window.ModManager.hasMod(message.modId);
            this.send({
                type: 'mod_response',
                modId: message.modId,
                available: hasMod,
                from: this.playerId
            });
        }
    }

    /**
     * Send message to all peers
     */
    send(message) {
        if (!this.connected) return;
        
        const data = typeof message === 'string' ? message : JSON.stringify(message);
        
        this.dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                try {
                    channel.send(data);
                } catch (e) {
                    console.warn('Send failed:', e);
                }
            }
        });
    }

    /**
     * Send binary message (for state updates - more efficient)
     */
    sendBinary(buffer) {
        this.dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                try {
                    channel.send(buffer);
                } catch (e) {}
            }
        });
    }

    /**
     * Encode state as binary for efficiency
     */
    encodeStateMessage(state) {
        // Format: [type(1), playerId(4), posX(4), posY(4), posZ(4), rotX(4), rotY(4), rotZ(4), rotW(4), velX(4), velY(4), velZ(4), steering(2), throttle(1), brake(1)]
        const buffer = new ArrayBuffer(54);
        const view = new DataView(buffer);
        
        view.setUint8(0, 1); // type: state
        view.setUint32(1, this.hashString(this.playerId));
        view.setFloat32(5, state.position[0]);
        view.setFloat32(9, state.position[1]);
        view.setFloat32(13, state.position[2]);
        view.setFloat32(17, state.rotation[0]);
        view.setFloat32(21, state.rotation[1]);
        view.setFloat32(25, state.rotation[2]);
        view.setFloat32(29, state.rotation[3]);
        view.setFloat32(33, state.velocity[0]);
        view.setFloat32(37, state.velocity[1]);
        view.setFloat32(41, state.velocity[2]);
        view.setFloat32(45, state.steering);
        view.setUint8(49, state.throttle * 255);
        view.setUint8(50, state.brake * 255);
        
        return buffer;
    }

    decodeBinaryMessage(buffer) {
        const view = new DataView(buffer);
        const type = view.getUint8(0);
        
        if (type === 1) {
            return {
                type: 'state',
                playerId: view.getUint32(1).toString(),
                state: {
                    position: [view.getFloat32(5), view.getFloat32(9), view.getFloat32(13)],
                    rotation: [view.getFloat32(17), view.getFloat32(21), view.getFloat32(25), view.getFloat32(29)],
                    velocity: [view.getFloat32(33), view.getFloat32(37), view.getFloat32(41)],
                    steering: view.getFloat32(45),
                    throttle: view.getUint8(49) / 255,
                    brake: view.getUint8(50) / 255
                }
            };
        }
        
        return { type: 'unknown' };
    }

    /**
     * Start the match (host only)
     */
    startMatch() {
        if (!this.isHost) return;
        
        this.send({
            type: 'match_start',
            timestamp: Date.now(),
            roomId: this.roomId
        });

        // Start network tick
        this.startNetworkTick();
    }

    /**
     * Start network tick loop
     */
    startNetworkTick() {
        const tickInterval = 1000 / this.tickRate;
        
        const tick = () => {
            if (!this.connected) return;
            
            const now = Date.now();
            if (now - this.lastTick >= tickInterval) {
                this.lastTick = now;
                this.sendLocalState();
            }
            
            requestAnimationFrame(tick);
        };
        
        tick();
    }

    /**
     * Send local player state
     */
    sendLocalState() {
        if (!window.VehicleAdapter) return;
        
        const vehicles = window.VehicleAdapter.getAllVehicles();
        const localVehicle = vehicles.find(v => v.isLocal);
        
        if (localVehicle) {
            const state = window.VehicleAdapter.getNetworkState(localVehicle);
            if (state) {
                const buffer = this.encodeStateMessage(state);
                this.sendBinary(buffer);
            }
        }
    }

    /**
     * Update room name
     */
    updateRoomName(name) {
        this.roomName = name;
        this.registerRoom();
    }

    /**
     * Check if current player is host
     */
    isHost() {
        return this.isHost;
    }

    /**
     * Generate unique room ID
     */
    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    /**
     * Generate unique player ID
     */
    generatePlayerId() {
        return 'P_' + Math.random().toString(36).substring(2, 10);
    }

    /**
     * Hash string to integer
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    /**
     * Broadcast ICE candidate
     */
    broadcastICE(candidate) {
        // In real implementation, send via signaling server
    }

    /**
     * Disconnect from network
     */
    disconnect() {
        this.connected = false;
        this.dataChannels.forEach(ch => ch.close());
        this.dataChannels.clear();
        
        if (this.peer) {
            this.peer.close();
        }

        // Remove room from discovery
        try {
            let rooms = JSON.parse(localStorage.getItem('game_rooms') || '[]');
            rooms = rooms.filter(r => r.id !== this.roomId);
            localStorage.setItem('game_rooms', JSON.stringify(rooms));
        } catch (e) {}

        this.isHost = false;
        this.isClient = false;
        this.roomId = null;
    }

    /**
     * Event emitter
     */
    on(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn(data));
        }
    }
}

window.NetworkManager = new NetworkManager();
