/**
 * InputManager - Handles all input (touch, keyboard, gamepad)
 */
class InputManager {
    constructor() {
        this.keys = {};
        this.touches = {};
        this.gamepad = null;
        this.steering = 0; // -1 to 1
        this.throttle = 0; // 0 to 1
        this.brake = 0;    // 0 to 1
        this.listeners = {};
        this.steerSpeed = 3.0;
        this.steerReturn = 5.0;
        this.maxSteerAngle = 0.6; // radians
    }

    /**
     * Initialize input listeners
     */
    init(canvas) {
        // Keyboard
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Gamepad
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepad = e.gamepad;
            console.log('Gamepad connected:', e.gamepad.id);
        });
        window.addEventListener('gamepaddisconnected', () => {
            this.gamepad = null;
        });
        
        // Start gamepad polling
        this.pollGamepad();
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
        this.emit('keydown', e.code);
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
        this.emit('keyup', e.code);
    }

    /**
     * Set steering from UI button
     */
    setSteering(direction) {
        // direction: -1 (left), 0 (center), 1 (right)
        if (direction === 0) {
            this.steerTarget = 0;
        } else {
            this.steerTarget = direction * this.maxSteerAngle;
        }
    }

    /**
     * Set throttle from UI button
     */
    setThrottle(value) {
        this.throttle = Math.max(0, Math.min(1, value));
    }

    /**
     * Set brake from UI button
     */
    setBrake(value) {
        this.brake = Math.max(0, Math.min(1, value));
    }

    /**
     * Update input state (called each frame)
     */
    update(deltaTime) {
        // Keyboard input
        let steerInput = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) steerInput -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) steerInput += 1;
        
        // Apply steering with smoothing
        if (steerInput !== 0) {
            this.steering += steerInput * this.steerSpeed * deltaTime;
            this.steering = Math.max(-this.maxSteerAngle, Math.min(this.maxSteerAngle, this.steering));
        } else if (!this.steerTarget) {
            // Return to center
            if (Math.abs(this.steering) > 0.01) {
                this.steering -= Math.sign(this.steering) * this.steerReturn * deltaTime;
            } else {
                this.steering = 0;
            }
        }
        
        // Keyboard throttle/brake
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.throttle = Math.min(1, this.throttle + deltaTime * 2);
        } else if (!this._touchThrottle) {
            this.throttle = Math.max(0, this.throttle - deltaTime * 3);
        }
        
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.brake = Math.min(1, this.brake + deltaTime * 3);
        } else if (!this._touchBrake) {
            this.brake = Math.max(0, this.brake - deltaTime * 4);
        }

        // Gamepad input
        if (this.gamepad) {
            this.updateGamepad();
        }
    }

    /**
     * Update gamepad state
     */
    updateGamepad() {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0];
        if (!gp) return;

        // Left stick for steering
        const steerX = gp.axes[0];
        if (Math.abs(steerX) > 0.1) {
            this.steering = steerX * this.maxSteerAngle;
        }

        // Right trigger for throttle
        if (gp.buttons[7]) {
            this.throttle = gp.buttons[7].value;
        }

        // Left trigger for brake
        if (gp.buttons[6]) {
            this.brake = gp.buttons[6].value;
        }
    }

    pollGamepad() {
        if (this.gamepad) {
            this.updateGamepad();
        }
        requestAnimationFrame(() => this.pollGamepad());
    }

    /**
     * Get current input state
     */
    getState() {
        return {
            steering: this.steering,
            throttle: this.throttle,
            brake: this.brake,
            keys: { ...this.keys }
        };
    }

    /**
     * Event system
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

    /**
     * Mark touch state for throttle/brake
     */
    setTouchThrottle(active) {
        this._touchThrottle = active;
    }

    setTouchBrake(active) {
        this._touchBrake = active;
    }
}

window.InputManager = new InputManager();
