/**
 * ControlButtons - Responsive touch controls for mobile
 */
class ControlButtons {
    constructor() {
        this.buttons = {};
        this.activeTouches = new Map();
        this.resizeHandler = null;
    }

    /**
     * Initialize control buttons
     */
    init() {
        this.setupButtons();
        this.setupTouchHandlers();
        this.setupResizeHandler();
        this.updateLayout();
    }

    /**
     * Setup button references
     */
    setupButtons() {
        this.buttons = {
            steerLeft: document.getElementById('btn-steer-left'),
            steerRight: document.getElementById('btn-steer-right'),
            gas: document.getElementById('btn-gas'),
            brake: document.getElementById('btn-brake'),
            cameraToggle: document.getElementById('btn-camera-toggle'),
            pause: document.getElementById('btn-pause')
        };
    }

    /**
     * Setup touch/pointer event handlers
     */
    setupTouchHandlers() {
        // Use Pointer Events for unified touch/mouse handling
        const addTouchHandler = (element, onPress, onRelease) => {
            if (!element) return;

            element.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                element.classList.add('pressed');
                this.activeTouches.set(e.pointerId, element.id);
                onPress(e);
            }, { passive: false });

            element.addEventListener('pointerup', (e) => {
                e.preventDefault();
                element.classList.remove('pressed');
                this.activeTouches.delete(e.pointerId);
                onRelease(e);
            }, { passive: false });

            element.addEventListener('pointercancel', (e) => {
                element.classList.remove('pressed');
                this.activeTouches.delete(e.pointerId);
                onRelease(e);
            });

            element.addEventListener('pointerleave', (e) => {
                element.classList.remove('pressed');
                this.activeTouches.delete(e.pointerId);
                onRelease(e);
            });

            // Prevent context menu
            element.addEventListener('contextmenu', (e) => e.preventDefault());
        };

        // Steering
        addTouchHandler(this.buttons.steerLeft,
            () => { InputManager.setSteering(-1); },
            () => { InputManager.setSteering(0); }
        );

        addTouchHandler(this.buttons.steerRight,
            () => { InputManager.setSteering(1); },
            () => { InputManager.setSteering(0); }
        );

        // Gas
        addTouchHandler(this.buttons.gas,
            () => { 
                InputManager.setThrottle(1);
                InputManager.setTouchThrottle(true);
            },
            () => { 
                InputManager.setThrottle(0);
                InputManager.setTouchThrottle(false);
            }
       
// ... (استكمال من السطر المقطوع)
        // Brake
        addTouchHandler(this.buttons.brake,
            () => { 
                InputManager.setBrake(1);
                InputManager.setTouchBrake(true);
            },
            () => { 
                InputManager.setBrake(0);
                InputManager.setTouchBrake(false);
            }
        );

        // Camera toggle
        if (this.buttons.cameraToggle) {
            this.buttons.cameraToggle.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.CameraAdapter) {
                    const mode = window.CameraAdapter.toggleCamera();
                    this.buttons.cameraToggle.textContent = mode === 'cockpit' ? '🎥' : '📷';
                }
            });
        }

        // Pause
        if (this.buttons.pause) {
            this.buttons.pause.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.GameEngine) {
                    window.GameEngine.togglePause();
                }
            });
        }
    }

    /**
     * Setup resize handler for responsive layout
     */
    setupResizeHandler() {
        this.resizeHandler = PerformanceOptimizer.debounce(() => {
            this.updateLayout();
        }, 150);
        
        window.addEventListener('resize', this.resizeHandler);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateLayout(), 200);
        });
    }

    /**
     * Update layout based on screen size and DPI
     */
    updateLayout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        const isLandscape = width > height;
        const isSmall = width < 400;
        const isTablet = width >= 768;

        // Calculate base button size based on viewport
        let baseSize;
        if (isLandscape) {
            baseSize = Math.min(height * 0.12, 64);
        } else {
            baseSize = Math.min(width * 0.15, 70);
        }

        // Adjust for DPI
        if (dpr >= 3) {
            baseSize *= 0.9; // Slightly smaller on very high DPI
        }

        // Apply to all control buttons
        const ctrlBtns = document.querySelectorAll('.ctrl-btn:not(.small-btn)');
        ctrlBtns.forEach(btn => {
            btn.style.width = `${baseSize}px`;
            btn.style.height = `${baseSize}px`;
        });

        const smallBtns = document.querySelectorAll('.small-btn');
        smallBtns.forEach(btn => {
            btn.style.width = `${baseSize * 0.75}px`;
            btn.style.height = `${baseSize * 0.75}px`;
        });

        // Adjust spacing
        const zones = document.querySelectorAll('.control-zone');
        const padding = isSmall ? 8 : isTablet ? 20 : 12;
        const gap = isSmall ? 6 : isTablet ? 14 : 10;
        
        zones.forEach(zone => {
            zone.style.padding = `${padding}px`;
            zone.style.gap = `${gap}px`;
        });
    }

    /**
     * Show/hide controls
     */
    setVisible(visible) {
        const hud = document.getElementById('game-hud');
        if (hud) {
            hud.classList.toggle('hidden', !visible);
        }
    }

    /**
     * Dispose
     */
    dispose() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
}

window.ControlButtons = new ControlButtons();
