/**
 * boot.js - loads the 3D libraries (CDN first, then ./libs for offline / Android),
 * then every game module in dependency order, then starts the game.
 * Menus keep working even if the 3D engine cannot be loaded.
 */
(function () {
    'use strict';

    const LIBS = [
        { cdn: 'https://cdn.babylonjs.com/babylon.js', local: 'libs/babylon.js', required: true, label: '3D engine' },
        { cdn: 'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js', local: 'libs/babylonjs.loaders.min.js', required: true, label: 'model loaders' },
        { cdn: 'https://cdn.babylonjs.com/havok/HavokPhysics_umd.js', local: 'libs/HavokPhysics_umd.js', required: false, label: 'physics' }
    ];

    const GAME = [
        'js/utils/ErrorHandle.js',
        'js/utils/ModSettings.js',
        'js/utils/PerformanceOptimiser.js',
        'js/engine/InputManager.js',
        'js/vehicle/VehicleDetector.js',
        'js/mods/GLBImporter.js',
        'js/mods/PhysicsAdapter.js',
        'js/mods/VehicleAdapter.js',
        'js/mods/MapAdapter.js',
        'js/mods/CameraAdapter.js',
        'js/mods/ModManager.js',
        'js/network/SyncManager.js',
        'js/network/NetworkManager.js',
        'js/ui/ControlButtons.js',
        'js/ui/HudManager.js',
        'js/ui/UIManager.js',
        'js/ui/MultiplayerUI.js',
        'js/engine/GameEngine.js',
        'js/main.js'
    ];

    const fill = document.getElementById('loader-fill');
    const text = document.getElementById('loading-text');
    const total = LIBS.length + GAME.length;
    let done = 0;

    function progress(msg) {
        done++;
        if (fill) fill.style.width = Math.round((done / total) * 100) + '%';
        if (text && msg) text.textContent = msg;
    }

    function loadScript(src, timeoutMs) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            let finished = false;
            const timer = setTimeout(() => {
                if (finished) return;
                finished = true;
                s.remove();
                reject(new Error('timeout ' + src));
            }, timeoutMs || 20000);
            s.async = false;
            s.onload = () => { if (finished) return; finished = true; clearTimeout(timer); resolve(); };
            s.onerror = () => { if (finished) return; finished = true; clearTimeout(timer); s.remove(); reject(new Error('failed ' + src)); };
            s.src = src;
            document.head.appendChild(s);
        });
    }

    async function loadLib(lib) {
        // file:// (Android assets) cannot reach a CDN reliably, so try ./libs first there
        const order = location.protocol === 'file:' ? [lib.local, lib.cdn] : [lib.cdn, lib.local];
        for (const src of order) {
            try { await loadScript(src, 15000); return true; } catch (e) { /* try next source */ }
        }
        return false;
    }

    async function boot() {
        window.QS_BOOT = { engineAvailable: false, physicsAvailable: false };

        for (const lib of LIBS) {
            if (text) text.textContent = 'Loading ' + lib.label + '…';
            const ok = await loadLib(lib);
            if (lib.label === '3D engine') window.QS_BOOT.engineAvailable = ok;
            if (lib.label === 'physics') window.QS_BOOT.physicsAvailable = ok;
            progress();
        }

        for (const src of GAME) {
            try {
                await loadScript(src, 15000);
            } catch (e) {
                console.error(e.message);
                if (text) text.textContent = 'Could not load ' + src;
            }
            progress('Loading game…');
        }

        if (window.QS && typeof window.QS.boot === 'function') {
            window.QS.boot();
        } else if (text) {
            text.textContent = 'Game failed to start. Reload the page.';
        }
    }

    boot();
})();
