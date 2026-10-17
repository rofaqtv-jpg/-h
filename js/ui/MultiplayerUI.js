/**
 * MultiplayerUI - Handles all multiplayer UI interactions
 */
class MultiplayerUI {
    constructor() {
        this.currentScreen = 'multiplayer-menu';
        this.roomsList = [];
        this.searchInterval = null;
    }

    /**
     * Initialize UI event listeners
     */
    init() {
        this.bindButtons();
        this.setupRoomNameInput();
    }

    /**
     * Bind all button events
     */
    bindButtons() {
        // Main menu buttons
        this.bind('btn-multiplayer', () => this.showScreen('multiplayer-menu'));
        this.bind('btn-create-host', () => this.onCreateHost());
        this.bind('btn-join-room', () => this.onJoinRoom());
        this.bind('btn-back-main', () => this.showScreen('main-menu'));
        this.bind('btn-back-multi', () => this.showScreen('multiplayer-menu'));
        this.bind('btn-back-join', () => {
            this.stopSearching();
            this.showScreen('multiplayer-menu');
        });
        this.bind('btn-start-game', () => this.onStartGame());
    }

    bind(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    /**
     * Show a specific screen
     */
    showScreen(screenId) {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) screen.classList.add('active');
        this.currentScreen = screenId;
    }

    /**
     * Handle create host button
     */
    async onCreateHost() {
        this.showScreen('host-screen');
        this.updateHostUI({
            roomName: document.getElementById('room-name')?.value || 'TURRINI ROOM',
            players: 1,
            maxPlayers: 4,
            roomId: '----'
        });

        // Try to create host
        try {
            if (window.NetworkManager) {
                const result = await window.NetworkManager.createHost();
                if (result) {
                    this.updateHostUI(result);
                }
            }
        } catch (e) {
            ErrorHandler.report(e, 'MultiplayerUI.onCreateHost');
            ErrorHandler.showUserError('Unable to create local Wi-Fi room.');
        }
    }

    /**
     * Handle join room button
     */
    async onJoinRoom() {
        this.showScreen('join-screen');
        this.startSearching();

        try {
            if (window.NetworkManager) {
                await window.NetworkManager.startDiscovery((rooms) => {
                    this.updateRoomsList(rooms);
                });
            }
        } catch (e) {
            ErrorHandler.report(e, 'MultiplayerUI.onJoinRoom');
            ErrorHandler.showUserError('Unable to discover local rooms.');
        }
    }

    /**
     * Start searching for rooms
     */
    startSearching() {
        const statusEl = document.getElementById('search-status');
        if (statusEl) statusEl.textContent = 'SEARCHING FOR LOCAL ROOMS...';
        
        // Clear existing list
        const listEl = document.getElementById('rooms-list');
        if (listEl) listEl.innerHTML = '';
    }

    /**
     * Stop searching
     */
    stopSearching() {
        if (this.searchInterval) {
            clearInterval(this.searchInterval);
            this.searchInterval = null;
        }
        if (window.NetworkManager) {
            window.NetworkManager.stopDiscovery();
        }
    }

    /**
     * Update rooms list in UI
     */
    updateRoomsList(rooms) {
        const listEl = document.getElementById('rooms-list');
        const statusEl = document.getElementById('search-status');
        
        if (!listEl) return;

        if (!rooms || rooms.length === 0) {
            if (statusEl) statusEl.textContent = 'NO ROOMS FOUND. KEEP SEARCHING...';
            listEl.innerHTML = '';
            return;
        }

        if (statusEl) statusEl.textContent = `${rooms.length} ROOM(S) FOUND`;
        
        listEl.innerHTML = rooms.map(room => `
            <div class="room-item" data-room-id="${room.id}">
                <div class="room-item-info">
                    <div class="room-item-name">${this.escapeHtml(room.name)}</div>
                    <div class="room-item-players">${room.players}/${room.maxPlayers} PLAYERS</div>
                </div>
                <button class="room-join-btn" data-room-id="${room.id}">JOIN</button>
            </div>
        `).join('');

        // Bind join buttons
        listEl.querySelectorAll('.room-join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const roomId = btn.dataset.roomId;
                this.joinRoom(roomId);
            });
        });
    }

    /**
     * Join a specific room
     */
    async joinRoom(roomId) {
        const statusEl = document.getElementById('search-status');
        if (statusEl) statusEl.textContent = 'CONNECTING...';

        try {
            if (window.NetworkManager) {
                const success = await window.NetworkManager.joinRoom(roomId);
                if (success) {
                    this.stopSearching();
                    this.enterGame();
                } else {
                    if (statusEl) statusEl.textContent = 'CONNECTION FAILED. TRY AGAIN.';
                }
            }
        } catch (e) {
            ErrorHandler.report(e, 'MultiplayerUI.joinRoom');
            if (statusEl) statusEl.textContent = 'UNABLE TO JOIN ROOM.';
        }
    }

    /**
     * Update host UI with current state
     */
    updateHostUI(state) {
        const roomIdEl = document.getElementById('room-id-display');
        const playersEl = document.getElementById('host-players');
        
        if (roomIdEl && state.roomId) {
            roomIdEl.textContent = state.roomId;
        }

        if (playersEl) {
            let html = `<div class="player-slot connected">HOST — Connected</div>`;
            for (let i = 2; i <= state.maxPlayers; i++) {
                if (state.players >= i) {
                    html += `<div class="player-slot connected">PLAYER ${i} — Connected</div>`;
                } else {
                    html += `<div class="player-slot empty">PLAYER ${i} — Empty</div>`;
                }
            }
            playersEl.innerHTML = html;
        }
    }

    /**
     * Handle start game button
     */
    onStartGame() {
        if (window.NetworkManager && window.NetworkManager.isHost()) {
            window.NetworkManager.startMatch();
            this.enterGame();
        }
    }

    /**
     * Enter the game (hide menus, show HUD)
     */
    enterGame() {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        const hud = document.getElementById('game-hud');
        if (hud) hud.classList.remove('hidden');
        
        const netStatus = document.getElementById('network-status');
        if (netStatus) netStatus.classList.remove('hidden');

        if (window.GameEngine) {
            window.GameEngine.startMultiplayerGame();
        }
    }

    /**
     * Update network status display
     */
    updateNetworkStatus(players, ping) {
        const playersEl = document.getElementById('network-players');
        const pingEl = document.getElementById('network-ping');
        
        if (playersEl) playersEl.textContent = `Players: ${players}/4`;
        if (pingEl) pingEl.textContent = `Ping: ${ping}ms`;
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Setup room name input
     */
    setupRoomNameInput() {
        const input = document.getElementById('room-name');
        if (input) {
            input.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                if (window.NetworkManager && window.NetworkManager.isHost()) {
                    window.NetworkManager.updateRoomName(name);
                }
            });
        }
    }

    /**
     * Show missing mod dialog
     */
    showMissingModDialog(modName) {
        ErrorHandler.showUserError(`MISSING MOD: ${modName}. All players must have the same mods.`);
    }
}

window.MultiplayerUI = new MultiplayerUI();
