/**
 * CameraAdapter - Manages external and cockpit cameras
 */
class CameraAdapter {
    constructor(scene) {
        this.scene = scene;
        this.currentMode = 'external'; // 'external' or 'cockpit'
        this.externalCamera = null;
        this.cockpitCamera = null;
        this.currentVehicle = null;
        this.smoothPosition = BABYLON.Vector3.Zero();
        this.smoothLookAt = BABYLON.Vector3.Zero();
    }

    /**
     * Initialize cameras
     */
    init() {
        // External follow camera
        this.externalCamera = new BABYLON.ArcRotateCamera(
            'externalCamera',
            Math.PI, Math.PI / 3, 10,
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.externalCamera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
        this.externalCamera.lowerRadiusLimit = 2;
        this.externalCamera.upperRadiusLimit = 50;
        this.externalCamera.wheelPrecision = 20;
        this.externalCamera.inputs.attached.touch.detachControl(); // We handle touch ourselves

        // Cockpit camera
        this.cockpitCamera = new BABYLON.FreeCamera(
            'cockpitCamera',
            new BABYLON.Vector3(0, 1.5, -0.3),
            this.scene
        );
        this.cockpitCamera.fov = 1.2; // Wide FOV for cockpit
        this.cockpitCamera.minZ = 0.05;
        this.cockpitCamera.maxZ = 1000;

        // Start with external camera
        this.scene.activeCamera = this.externalCamera;
    }

    /**
     * Attach camera to a vehicle
     */
    attachToVehicle(vehicle) {
        this.currentVehicle = vehicle;
        
        const settings = vehicle.settings;
        const dims = settings.dimensions;

        // Configure external camera based on vehicle size
        this.configureExternalCamera(vehicle);
        
        // Configure cockpit camera
        this.configureCockpitCamera(vehicle);
    }

    /**
     * Configure external camera dynamically based on vehicle dimensions
     */
    configureExternalCamera(vehicle) {
        const settings = vehicle.settings;
        const dims = settings.dimensions;
        const camSettings = settings.externalCamera;

        // Distance based on vehicle length
        const distance = camSettings.distance || Math.max(dims.z * 1.5, 5);
        const height = camSettings.height || Math.max(dims.y * 1.8, 2.5);

        this.externalCamera.radius = distance;
        this.externalCamera.beta = Math.PI / 2.5; // Angle from top
        this.externalCamera.alpha = Math.PI; // Behind vehicle

        // Set target offset
        this.externalCamera.targetScreenOffset = new BABYLON.Vector2(0, 0);
        
        // Store camera config for updates
        this._camConfig = {
            distance: distance,
            height: height,
            lag: camSettings.lag || 0.1,
            lookAtOffset: camSettings.lookAtOffset || { x: 0, y: dims.y * 0.4, z: 0 }
        };

        // Initialize smooth position
        if (vehicle.rootNode) {
            this.smoothPosition = vehicle.rootNode.position.clone();
            this.smoothLookAt = vehicle.rootNode.position.add(
                new BABYLON.Vector3(0, dims.y * 0.4, 0)
            );
        }
    }

    /**
     * Configure cockpit camera based on vehicle
     */
    configureCockpitCamera(vehicle) {
        const settings = vehicle.settings;
        const detection = vehicle.detection;
        const camSettings = settings.cockpitCamera;

        let camPos;
        
        // Use detected driver position if available
        if (detection.driverPosition) {
            camPos = detection.driverPosition.clone();
            camPos.y += 0.3; // Slightly above eye level
        } else if (camSettings.position) {
            camPos = new BABYLON.Vector3(
                camSettings.position.x,
                camSettings.position.y,
                camSettings.position.z
            );
        } else {
            // Fallback: calculate from dimensions
            const dims = settings.dimensions;
            camPos = new BABYLON.Vector3(0, dims.y * 0.7, -dims.z * 0.1);
        }

        this.cockpitCamera.position = camPos;
        this.cockpitCamera.rotation = new BABYLON.Vector3(0, Math.PI, 0); // Looking forward
    }

    /**
     * Update cameras each frame
     */
    update(deltaTime) {
        if (!this.currentVehicle || !this.currentVehicle.rootNode) return;

        const vehicle = this.currentVehicle;
        const rootNode = vehicle.rootNode;

        if (this.currentMode === 'external') {
            this.updateExternalCamera(vehicle, deltaTime);
        } else {
            this.updateCockpitCamera(vehicle, deltaTime);
        }
    }

    /**
     * Update external camera with smooth follow
     */
    updateExternalCamera(vehicle, deltaTime) {
        const rootNode = vehicle.rootNode;
        const config = this._camConfig;
        if (!config) return;

        // Calculate desired camera position (behind and above vehicle)
        const vehicleForward = rootNode.getDirection ? 
            rootNode.getDirection(BABYLON.Axis.Z).scale(-1) :
            new BABYLON.Vector3(0, 0, -1);
        
        const vehicleUp = new BABYLON.Vector3(0, 1, 0);

        // Desired position: behind and above
        const desiredPosition = rootNode.position
            .subtract(vehicleForward.scale(config.distance))
            .add(vehicleUp.scale(config.height));

        // Look-at target: slightly ahead of vehicle
        const lookAtTarget = rootNode.position.add(
            vehicleForward.scale(3)
        ).add(new BABYLON.Vector3(0, config.lookAtOffset.y, 0));

        // Smooth interpolation
        const lerpFactor = Math.min(1, deltaTime / config.lag);
        this.smoothPosition = BABYLON.Vector3.Lerp(this.smoothPosition, desiredPosition, lerpFactor);
        this.smoothLookAt = BABYLON.Vector3.Lerp(this.smoothLookAt, lookAtTarget, lerpFactor);

        // Apply to camera
        this.externalCamera.target = this.smoothLookAt;
        
        // Calculate camera angles from smooth position
        const direction = this.smoothPosition.subtract(this.smoothLookAt);
        const distance = direction.length();
        
        this.externalCamera.radius = distance;
        this.externalCamera.alpha = Math.atan2(direction.x, direction.z);
        this.externalCamera.beta = Math.acos(direction.y / distance);

        // Speed-based camera behavior
        const speed = vehicle.state.speed;
        if (speed > 80) {
            // Pull back at high speed
            this.externalCamera.radius = Math.min(config.distance * 1.3, this.externalCamera.radius * 1.01);
        } else if (speed < 10) {
            // Bring closer at low speed
            this.externalCamera.radius = Math.max(config.distance * 0.8, this.externalCamera.radius * 0.99);
        }

        // Camera collision handling
        this.handleCameraCollision();
    }

    /**
     * Update cockpit camera (follows vehicle)
     */
    updateCockpitCamera(vehicle, deltaTime) {
        const rootNode = vehicle.rootNode;
        
        // Get local cockpit position in world space
        const localPos = this.cockpitCamera._localOffset || new BABYLON.Vector3(0, 1.5, -0.3);
        
        // Transform to world space using vehicle's world matrix
        const worldMatrix = rootNode.getWorldMatrix();
        const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
        
        this.cockpitCamera.position = worldPos;
        
        // Look in vehicle's forward direction
        const forward = rootNode.getDirection ? 
            rootNode.getDirection(BABYLON.Vector3.Forward()) :
            new BABYLON.Vector3(0, 0, -1);
        
        const lookAt = worldPos.add(forward.scale(10));
        this.cockpitCamera.setTarget(lookAt);
    }

    /**
     * Handle camera collision (prevent camera going through walls)
     */
    handleCameraCollision() {
        // Raycast from target to camera position
        const ray = new BABYLON.Ray(
            this.externalCamera.target,
            this.smoothPosition.subtract(this.externalCamera.target).normalize(),
            this.externalCamera.radius
        );

        const pick = this.scene.pickWithRay(ray, (mesh) => {
            return mesh !== this.currentVehicle?.rootNode && 
                   mesh.isEnabled && 
                   mesh.isPickable;
        });

        if (pick && pick.hit && pick.distance < this.externalCamera.radius) {
            // Move camera closer to avoid clipping
            this.externalCamera.radius = pick.distance * 0.9;
        }
    }

    /**
     * Toggle between external and cockpit camera
     */
    toggleCamera() {
        if (this.currentMode === 'external') {
            this.currentMode = 'cockpit';
            this.scene.activeCamera = this.cockpitCamera;
        } else {
            this.currentMode = 'external';
            this.scene.activeCamera = this.externalCamera;
        }
        
        this.cockpitCamera.attachControl(this.scene.getEngine().getRenderingCanvas(), false);
        this.externalCamera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
        
        return this.currentMode;
    }

    /**
     * Set camera mode
     */
    setMode(mode) {
        this.currentMode = mode;
        this.scene.activeCamera = mode === 'cockpit' ? this.cockpitCamera : this.externalCamera;
    }

    /**
     * Get current camera
     */
    getActiveCamera() {
        return this.currentMode === 'cockpit' ? this.cockpitCamera : this.externalCamera;
    }

    /**
     * Detach from vehicle
     */
    detach() {
        this.currentVehicle = null;
    }
}

window.CameraAdapter = CameraAdapter;
