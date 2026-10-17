/**
 * PhysicsAdapter - Manages Havok physics integration
 */
class PhysicsAdapter {
    constructor(scene) {
        this.scene = scene;
        this.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.initialized = false;
    }

    /**
     * Initialize Havok physics
     */
    async init() {
        if (this.initialized) return;

        try {
            const havokInstance = await HavokPhysics();
            const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
            this.scene.enablePhysics(this.gravity, havokPlugin);
            this.initialized = true;
            console.log('Havok Physics initialized successfully');
        } catch (e) {
            ErrorHandler.report(e, 'PhysicsAdapter.init');
            // Fallback: try Ammo.js
            try {
                await this.initAmmoFallback();
            } catch (e2) {
                console.error('All physics engines failed to initialize');
            }
        }
    }

    /**
     * Fallback to Ammo.js
     */
    async initAmmoFallback() {
        const ammoInstance = await Ammo();
        const ammoPlugin = new BABYLON.AmmoJSPlugin(true, ammoInstance);
        this.scene.enablePhysics(this.gravity, ammoPlugin);
        this.initialized = true;
        console.log('Ammo.js Physics initialized (fallback)');
    }

    /**
     * Create physics body for a mesh
     */
    createBody(mesh, type = 'dynamic', options = {}) {
        if (!this.initialized) {
            console.warn('Physics not initialized');
            return null;
        }

        try {
            const motionType = type === 'static' ? BABYLON.PhysicsMotionType.STATIC :
                              type === 'kinematic' ? BABYLON.PhysicsMotionType.KINEMATIC :
                              BABYLON.PhysicsMotionType.DYNAMIC;

            const body = new BABYLON.PhysicsBody(mesh, motionType, false, this.scene);
            
            // Set mass properties
            const massProps = {
                mass: options.mass || (type === 'static' ? 0 : 1),
                friction: options.friction || 0.5,
                restitution: options.restitution || 0.3
            };

            body.setMassProperties(massProps);
            return body;
        } catch (e) {
            ErrorHandler.report(e, 'PhysicsAdapter.createBody', false);
            return null;
        }
    }

    /**
     * Create box shape
     */
    createBoxShape(size, center = BABYLON.Vector3.Zero()) {
        return new BABYLON.PhysicsShapeBox(
            center,
            BABYLON.Quaternion.Identity(),
            size,
            this.scene
        );
    }

    /**
     * Create sphere shape
     */
    createSphereShape(radius, center = BABYLON.Vector3.Zero()) {
        return new BABYLON.PhysicsShapeSphere(
            center,
            radius,
            this.scene
        );
    }

    /**
     * Create cylinder shape
     */
    createCylinderShape(pointA, pointB, radius) {
        return new BABYLON.PhysicsShapeCylinder(
            pointA, pointB, radius, this.scene
        );
    }

    /**
     * Create convex hull from mesh
     */
    createConvexHull(mesh) {
        return new BABYLON.PhysicsShapeMesh(mesh, this.scene);
    }

    /**
     * Raycast for ground detection
     */
    raycast(origin, direction, maxDistance) {
        if (!this.initialized) return null;

        const ray = new BABYLON.Ray(origin, direction, maxDistance);
        const pickInfo = this.scene.physicsRaycast(ray);
        
        return pickInfo;
    }

    /**
     * Update physics (called each frame by engine)
     */
    update(deltaTime) {
        // Physics is handled by Babylon.js internally
        // This is for any custom physics logic
    }

    /**
     * Set gravity
     */
    setGravity(gravity) {
        if (this.scene.physicsEngine) {
            this.scene.physicsEngine.setGravity(gravity);
        }
        this.gravity = gravity;
    }

    /**
     * Debug render physics shapes
     */
    toggleDebugRender() {
        if (this.scene.physicsEngine) {
            // Toggle debug visualization
            this._debugEnabled = !this._debugEnabled;
        }
    }
}

window.PhysicsAdapter = PhysicsAdapter;
