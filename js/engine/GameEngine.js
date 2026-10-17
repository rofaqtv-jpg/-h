/**
 * GameEngine - Main game loop and coordination
 */
class GameEngine {
    constructor() {
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.isRunning = false;
        this.isPaused = false;
        this.isMultiplayer = false;
        this.lastTime = 0;
    }

    /**
     * Initialize the engine
     */
    async init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            ErrorHandler.report(new Error('Canvas not found'), 'GameEngine.init');
            return;
        }

        // Create Babylon engine
        this.engine = new BABYLON.Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            antialias: true
        });

        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.1, 0.15, 0.2, 1);
        this.scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        // Setup lighting
        this.setupLighting();

        // Setup skybox
        this.setupSkybox();

        // Initialize physics
        const physics = new PhysicsAdapter(this.scene);
        await physics.init();
        window.PhysicsAdapter = physics;

        // Initialize cameras
        const camera = new CameraAdapter(this.scene);
        camera.init();
        window.CameraAdapter = camera;

        // Initialize mod manager
        window.ModManager.init(this.scene, this.engine);

        // Initialize input
        window.InputManager.init(this.canvas);

        // Initialize UI
        window.UIManager.init();
        window.MultiplayerUI.init();
        window.ControlButtons.init();

        // Setup render loop
        this.engine.runRenderLoop(() => this.render());
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        this.isRunning = true;
        console.log('Game engine initialized');
    }

    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Directional light (sun)
        const dirLight = new BABYLON.DirectionalLight(
            'sunLight',
            new BABYLON.Vector3(-0.5, -1, -0.5),
            this.scene
        );
        dirLight.intensity = 1.2;
        dirLight.diffuse = new BABYLON.Color3(1, 0.95, 0.9);

        // Hemispheric light (ambient)
        const hemiLight = new BABYLON.HemisphericLight(
            'ambientLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        hemiLight.intensity = 0.5;
        hemiLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3);
    }

    /**
     * Setup skybox
     */
    setupSkybox() {
        const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000 }, this.scene);
        const skyMat = new BABYLON.StandardMaterial('skyMat', this.scene);
        skyMat.backFaceCulling = false;
        skyMat.disableLighting = true;
        skyMat.emissiveColor = new BABYLON.Color3(0.3, 0.5, 0.8);
        skybox.material = skyMat;
        skybox.infiniteDistance = true;
    }

    /**
     * Main render loop
     */
    render() {
        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = now;

        if (!this.isPaused && this.isRunning) {
            this.update(deltaTime);
        }

        this.scene.render();
    }

    /**
     * Update game logic
     */
    update(deltaTime) {
        // Update input
        window.InputManager.update(deltaTime);

        // Update vehicles
        if (window.VehicleAdapter) {
            const vehicles = window.VehicleAdapter.getAllVehicles();
            const input = window.InputManager.getState();
            
            vehicles.forEach(vehicle => {
                if (vehicle.isLocal) {
                    window.VehicleAdapter.updateVehicle(vehicle, input, deltaTime);
                }
            });
        }

        // Update cameras
        if (window.CameraAdapter) {
            window.CameraAdapter.update(deltaTime);
        }

        // Update sync manager
        if (window.SyncManager) {
            window.SyncManager.update(deltaTime);
        }

        // Update UI
        this.updateHUD();
    }

    /**
     * Update HUD elements
     */
    updateHUD() {
        if (window.VehicleAdapter) {
            const vehicles = window.VehicleAdapter.getAllVehicles();
            const local = vehicles.find(v => v.isLocal);
            if (local) {
                const speedEl = document.getElementById('speed-display');
                if (speedEl) {
                    speedEl.textContent = `${Math.round(local.state.speed)} km/h`;
                }
            }
        }

        // Network status
        if (this.isMultiplayer && window.NetworkManager) {
            const players = window.NetworkManager.players.size;
            window.MultiplayerUI.updateNetworkStatus(players, '--');
        }
    }

    /**
     * Start free drive mode
     */
    async startFreeDrive() {
        this.isMultiplayer = false;
        
        // Create default ground
        this.createDefaultGround();
    }

    /**
     * Start multiplayer game
     */
    async startMultiplayerGame() {
        this.isMultiplayer = true;
        this.createDefaultGround();
        
        // Start network tick if host
        if (window.NetworkManager && window.NetworkManager.isHost()) {
            window.NetworkManager.startMatch();
        }
    }

    /**
     * Create default ground for testing
     */
    createDefaultGround() {
        const ground = BABYLON.MeshBuilder.CreateGround('defaultGround', {
            width: 200,
            height: 200,
            subdivisions: 4
        }, this.scene);

        const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.35, 0.3);
        groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = groundMat;

        // Add physics
        ground.physicsBody = new BABYLON.PhysicsBody(ground, BABYLON.PhysicsMotionType.STATIC, false, this.scene);
        ground.physicsBody.shape = new BABYLON.PhysicsShapeBox(
            BABYLON.Vector3.Zero(),
            BABYLON.Quaternion.Identity(),
            new BABYLON.Vector3(200, 0.1, 200),
            this.scene
        );
        ground.physicsBody.setMassProperties({ mass: 0, friction: 0.8 });
    }

    /**
     * Toggle pause
     */
    togglePause() {
        this.isPaused = !this.isPaused;
    }

    /**
     * Dispose engine
     */
    dispose() {
        this.isRunning = false;
        if (this.scene) this.scene.dispose();
        if (this.engine) this.engine.dispose();
    }
}

window.GameEngine = new GameEngine();
