/**
 * Main entry point - Initialize everything
 */
(async function main() {
    'use strict';

    console.log('=== Driving Simulator Starting ===');

    // Wait for DOM
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    try {
        // Initialize game engine
        await window.GameEngine.init();
        
        console.log('=== Game Ready ===');
        
        // Show main menu
        window.UIManager.showScreen('main-menu');

    } catch (error) {
        console.error('Failed to start game:', error);
        ErrorHandler.report(error, 'Main', true);
    }

    // Handle visibility change (pause when tab hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && window.GameEngine) {
            window.GameEngine.isPaused = true;
        }
    });

    // Handle before unload (cleanup)
    window.addEventListener('beforeunload', () => {
        if (window.NetworkManager) {
            window.NetworkManager.disconnect();
        }
        if (window.GameEngine) {
            window.GameEngine.dispose();
        }
    });

})();
