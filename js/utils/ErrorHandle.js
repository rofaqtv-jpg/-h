/**
 * ErrorHandler - Centralized error handling system
 * Prevents game crashes and provides user-friendly messages
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.listeners = [];
    }

    /**
     * Report an error with context
     */
    report(error, context = 'Unknown', showToUser = true) {
        const errorEntry = {
            timestamp: Date.now(),
            message: error.message || String(error),
            context: context,
            stack: error.stack || null,
            type: error.name || 'Error'
        };

        this.errorLog.push(errorEntry);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // Log to console for debugging
        console.error(`[${context}] ${errorEntry.message}`);
        if (error.stack) {
            console.error(error.stack);
        }

        // Show to user if requested
        if (showToUser) {
            this.showUserError(errorEntry.message, context);
        }

        // Notify listeners
        this.listeners.forEach(fn => fn(errorEntry));
    }

    /**
     * Show error dialog to user
     */
    showUserError(message, context = '') {
        const dialog = document.getElementById('error-dialog');
        const msgEl = document.getElementById('error-message');
        
        if (dialog && msgEl) {
            msgEl.textContent = message;
            dialog.classList.remove('hidden');
        }
    }

    /**
     * Hide error dialog
     */
    hideUserError() {
        const dialog = document.getElementById('error-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
    }

    /**
     * Wrap async operation with error handling
     */
    async safeAsync(operation, context = 'AsyncOp') {
        try {
            return await operation();
        } catch (error) {
            this.report(error, context);
            return null;
        }
    }

    /**
     * Wrap sync operation with error handling
     */
    safeSync(operation, context = 'SyncOp', fallback = null) {
        try {
            return operation();
        } catch (error) {
            this.report(error, context);
            return fallback;
        }
    }

    /**
     * Add error listener
     */
    addListener(fn) {
        this.listeners.push(fn);
    }

    /**
     * Get all errors
     */
    getErrors() {
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    clear() {
        this.errorLog = [];
    }
}

// Global instance
window.ErrorHandler = new ErrorHandler();

// Global unhandled error handlers
window.addEventListener('error', (e) => {
    window.ErrorHandler.report(e.error || e.message, 'WindowError', false);
});

window.addEventListener('unhandledrejection', (e) => {
    window.ErrorHandler.report(e.reason, 'UnhandledPromise', false);
});
