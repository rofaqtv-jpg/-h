/**
 * UIManager - Central UI management
 */
class UIManager {
    constructor() {
        this.screens = {};
        this.currentScreen = 'main-menu';
    }

    init() {
        this.bindMainMenu();
        this.bindModManager();
        this.bindErrorDialog();
        this.setupFileInput();
    }

    bindMainMenu() {
        this.bind('btn-free-drive', () => this.startFreeDrive());
        this.bind('btn-mod-manager', () => this.showScreen('mod-manager-screen'));
        this.bind('btn-settings', () => this.showSettings());
    }

    bindModManager() {
        this.bind('btn-import-vehicle', () => this.importVehicle());
        this.bind('btn-import-map', () => this.importMap());
        this.bind('btn-wheel-setup', () => this.showWheelSetup());
        this.bind('btn-back-mods', () => this.showScreen('main-menu'));
        this.bind('btn-back-setup', () => this.showScreen('mod-manager-screen'));
        this.bind('btn-save-setup', () => this.saveWheelSetup());
    }

    bindErrorDialog() {
        this.bind('btn-error-ok', () => ErrorHandler.hideUserError());
    }

    bind(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    showScreen(id) {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        this.currentScreen = id;
    }

    showLoading(text) {
        const loading = document.getElementById('loading-screen');
        const textEl = document.getElementById('loading-text');
        if (loading) loading.classList.add('active');
        if (textEl) textEl.textContent = text || 'Loading...';
    }

    hideLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.remove('active');
    }

    async startFreeDrive() {
        this.showLoading('Starting game...');
        if (window.GameEngine) {
            await window.GameEngine.startFreeDrive();
        }
        this.hideLoading();
        this.showScreen('');
        document.getElementById('game-hud')?.classList.remove('hidden');
    }

    importVehicle() {
        this.triggerFileImport('vehicle');
    }

    importMap() {
        this.triggerFileImport('map');
    }

    triggerFileImport(type) {
        const input = document.getElementById('file-input');
        if (input) {
            input.dataset.importType = type;
            input.click();
        }
    }

    setupFileInput() {
        const input = document.getElementById('file-input');
        if (!input) return;

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const type = input.dataset.importType || 'vehicle';
            
            for (const file of files) {
                await this.handleImportedFile(file, type);
            }
            
            input.value = '';
        });
    }

    async handleImportedFile(file, type) {
        this.showLoading(`Loading ${file.name}...`);
        
        try {
            if (window.ModManager) {
                const modData = await window.ModManager.importMod(file, type);
                if (modData) {
                    this.refreshModsList();
                    ErrorHandler.showUserError = () => {}; // Suppress success
                    console.log(`Mod imported: ${modData.modId}`);
                }
            }
        } catch (e) {
            ErrorHandler.report(e, 'UIManager.handleImportedFile');
        } finally {
            this.hideLoading();
        }
    }

    refreshModsList() {
        const listEl = document.getElementById('mods-list');
        if (!listEl || !window.ModManager) return;

        const mods = window.ModManager.getAllMods();
        if (mods.length === 0) {
            listEl.innerHTML = '<p style="color:#888;text-align:center;">No mods imported yet.</p>';
            return;
        }

        listEl.innerHTML = mods.map(mod => `
            <div class="mod-item" data-mod-id="${mod.modId}">
                <div class="mod-item-info">
                    <div class="mod-item-name">${this.escapeHtml(mod.name)}</div>
                    <div class="mod-item-type">${mod.type} • ${mod.modId.substring(0, 12)}...</div>
                </div>
                <div class="mod-item-actions">
                    <button class="mod-action-btn" data-action="spawn" data-mod-id="${mod.modId}">SPAWN</button>
                    <button class="mod-action-btn" data-action="delete" data-mod-id="${mod.modId}">DELETE</button>
                </div>
            </div>
        `).join('');

        // Bind actions
        listEl.querySelectorAll('[data-action="spawn"]').forEach(btn => {
            btn.addEventListener('click', () => this.spawnMod(btn.dataset.modId));
        });
        listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMod(btn.dataset.modId));
        });
    }

    async spawnMod(modId) {
        if (window.ModManager) {
            await window.ModManager.spawnMod(modId);
            this.showScreen('');
            document.getElementById('game-hud')?.classList.remove('hidden');
        }
    }

    deleteMod(modId) {
        if (window.ModManager) {
            window.ModManager.deleteMod(modId);
            this.refreshModsList();
        }
    }

    showWheelSetup() {
        this.showScreen('wheel-setup-screen');
    }

    saveWheelSetup() {
        // Wheel setup logic - save to ModSettings
        this.showScreen('mod-manager-screen');
    }

    showSettings() {
        // Placeholder for settings screen
        console.log('Settings not implemented yet');
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.UIManager = new UIManager();
