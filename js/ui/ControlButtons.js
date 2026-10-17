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
       
