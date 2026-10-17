/**
 * VehicleAdapter - Adapts loaded GLB mods into drivable vehicles
 */
class VehicleAdapter {
    constructor(scene) {
        this.scene = scene;
        this.detector = window.VehicleDetector;
        this.vehicles = new Map();
    }

    /**
     * Create a vehicle from mod data
     */
    async createVehicle(modData) {
        return ErrorHandler.safeAsync(async () => {
            // Detect vehicle components
            const detection = this.detector.detect(modData);
            
            // Get or create settings
            let settings = ModSettings.getModSettings(modData.modId);
            if (!settings) {
                settings = this.createDefaultSettings(modData, detection);
                ModSettings.setModSettings(modData.modId, settings);
            }

            // Check if wheels need manual setup
            if (!this.detector.allWheelsFound(detection)) {
                settings.needsWheelSetup = true;
                ModSettings.setModSettings(modData.modId, settings);
            }

            // Create vehicle object
            const vehicle = {
                id: modData.modId,
                modData: modData,
                detection: detection,
                settings: settings,
                rootNode: modData.rootNode,
                type: detection.vehicleType,
                wheels: {},
                physicsBody: null,
                wheelColliders: [],
                visualWheels: [],
                state: {
                    speed: 0,
                    steering: 0,
                    throttle: 0,
                    brake: 0,
                    rpm: 0,
                    gear: 1,
                    engineRunning: true
                },
                networkState: null
            };

            // Setup physics
            await this.setupPhysics(vehicle);

            // Setup visual wheels
            this.setupVisualWheels(vehicle);

            // Setup camera targets
            this.setupCameraTargets(vehicle);

            this.vehicles.set(vehicle.id, vehicle);
            return vehicle;
        }, 'VehicleAdapter.createVehicle');
    }

    /**
     * Create default settings based on detection
     */
    createDefaultSettings(modData, detection) {
        const dims = modData.dimensions;
        const type = detection.vehicleType;
        
        let mass, wheelRadius;
        
        switch (type) {
            case 'bicycle':
                mass = 15;
                wheelRadius = 0.35;
                break;
            case 'motorcycle':
                mass = 200;
                wheelRadius = 0.35;
                break;
            case 'bus':
                mass = 12000;
                wheelRadius = 0.5;
                break;
            case 'truck':
                mass = 8000;
                wheelRadius = 0.5;
                break;
            case 'airplane':
                mass = 5000;
                wheelRadius = 0.3;
                break;
            default: // car
                mass = 1500;
                wheelRadius = 0.35;
        }

        // Calculate wheel radius from detected wheels
        if (detection.wheels.FL && detection.wheels.FL.mesh) {
            const wheelMesh = detection.wheels.FL.mesh;
            const bounds = wheelMesh.getBoundingInfo();
            if (bounds) {
                const size = bounds.boundingBox.maximumWorld.subtract(bounds.boundingBox.minimumWorld);
                wheelRadius = Math.max(size.x, size.y, size.z) / 2;
            }
        }

        return {
            modId: modData.modId,
            vehicleType: type,
            mass: mass,
            wheelRadius: wheelRadius,
            centerOfMass: detection.centerOfMass,
            dimensions: dims,
            driverPosition: detection.driverPosition,
            wheelNodes: {
                FL: detection.wheels.FL?.nodeName || null,
                FR: detection.wheels.FR?.nodeName || null,
                RL: detection.wheels.RL?.nodeName || null,
                RR: detection.wheels.RR?.nodeName || null
            },
            wheelAxes: {
                FL: detection.wheelAxes.FL,
                FR: detection.wheelAxes.FR,
                RL: detection.wheelAxes.RL,
                RR: detection.wheelAxes.RR
            },
            externalCamera: {
                distance: Math.max(dims.z * 1.2, 4),
                height: Math.max(dims.y * 1.5, 2),
                lag: 0.1,
                lookAtOffset: { x: 0, y: dims.y * 0.4, z: 0 }
            },
            cockpitCamera: {
                position: detection.driverPosition,
                rotation: { x: 0, y: 0, z: 0 }
            },
            collisionSettings: {
                friction: 0.7,
                restitution: 0.1,
                shape: 'box'
            },
            suspension: {
                stiffness: type === 'motorcycle' ? 80 : 50,
                damping: 5,
                restLength: wheelRadius * 0.8,
                travel: wheelRadius * 0.6
            },
            needsWheelSetup: false,
            scale: modData.scale
        };
    }

    /**
     * Setup physics for the vehicle
     */
    async setupPhysics(vehicle) {
        const settings = vehicle.settings;
        const rootNode = vehicle.rootNode;
        const dims = settings.dimensions;

        // Create physics body (compound collider for performance)
        const physicsShape = new BABYLON.PhysicsShapeBox(
            new BABYLON.Vector3(0, dims.y / 2, 0),
            BABYLON.Quaternion.Identity(),
            new BABYLON.Vector3(dims.x * 0.9, dims.y * 0.8, dims.z * 0.9),
            this.scene
        );

        const physicsProps = {
            mass: settings.mass,
            friction: settings.collisionSettings.friction,
            restitution: settings.collisionSettings.restitution
        };

        rootNode.physicsBody = new BABYLON.PhysicsBody(rootNode, BABYLON.PhysicsMotionType.DYNAMIC, false, this.scene);
        rootNode.physicsBody.shape = physicsShape;
        rootNode.physicsBody.setMassProperties(physicsProps);

        // Set center of mass
        if (settings.centerOfMass) {
            rootNode.physicsBody.setMassProperties({
                ...physicsProps,
                centerOfMass: settings.centerOfMass
            });
        }

        vehicle.physicsBody = rootNode.physicsBody;

        // Create wheel colliders
        this.createWheelColliders(vehicle);
    }

    /**
     * Create wheel colliders for physics
     */
    createWheelColliders(vehicle) {
        const settings = vehicle.settings;
        const wheelRadius = settings.wheelRadius;
        const suspension = settings.suspension;

        const wheelPositions = ['FL', 'FR', 'RL', 'RR'];
        
        wheelPositions.forEach(pos => {
            const wheelData = vehicle.detection.wheels[pos];
            if (!wheelData) return;

            const localPos = wheelData.position;
            
            // Create wheel physics shape (cylinder)
            const wheelShape = new BABYLON.PhysicsShapeCylinder(
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(0, 0, 0), // Will be set by suspension
                wheelRadius,
                this.scene
            );

            vehicle.wheelColliders.push({
                position: pos,
                localPos: localPos.clone(),
                radius: wheelRadius,
                shape: wheelShape,
                suspension: {
                    stiffness: suspension.stiffness,
                    damping: suspension.damping,
                    restLength: suspension.restLength,
                    maxLength: suspension.restLength + suspension.travel,
                    currentLength: suspension.restLength
                },
                steering: (pos === 'FL' || pos === 'FR'),
                drive: (pos === 'RL' || pos === 'RR'),
                rotation: 0,
                steerAngle: 0
            });
        });
    }

    /**
     * Setup visual wheels (separate from physics)
     */
    setupVisualWheels(vehicle) {
        const wheelPositions = ['FL', 'FR', 'RL', 'RR'];
        
        wheelPositions.forEach(pos => {
            const wheelData = vehicle.detection.wheels[pos];
            
            vehicle.visualWheels.push({
                position: pos,
                mesh: wheelData?.mesh || null,
                nodeName: wheelData?.nodeName || null,
                rotationAxis: vehicle.detection.wheelAxes[pos] || new BABYLON.Vector3(1, 0, 0),
                currentRotation: 0,
                steerAngle: 0,
                baseRotation: wheelData?.mesh?.rotation?.clone() || BABYLON.Vector3.Zero()
            });
        });
    }

    /**
     * Setup camera targets for the vehicle
     */
    setupCameraTargets(vehicle) {
        const settings = vehicle.settings;
        const dims = settings.dimensions;

        // External camera follow target (slightly above and behind center)
        vehicle.cameraTarget = new BABYLON.Vector3(0, dims.y * 0.5, 0);
        
        // Look-at target (slightly ahead of vehicle center)
        vehicle.lookAtTarget = new BABYLON.Vector3(0, dims.y * 0.4, -dims.z * 0.2);
    }

    /**
     * Update vehicle state each frame
     */
    updateVehicle(vehicle, input, deltaTime) {
        if (!vehicle || !vehicle.physicsBody) return;

        const state = vehicle.state;
        
        // Update steering
        state.steering = input.steering;
        state.throttle = input.throttle;
        state.brake = input.brake;

        // Apply forces
        this.applyDriveForce(vehicle, deltaTime);
        this.applySteering(vehicle, deltaTime);
        this.applyBraking(vehicle, deltaTime);

        // Update visual wheels
        this.updateVisualWheels(vehicle, deltaTime);

        // Update speed display
        if (vehicle.physicsBody.getLinearVelocity) {
            const velocity = vehicle.physicsBody.getLinearVelocity();
            state.speed = velocity.length() * 3.6; // m/s to km/h
        }
    }

    /**
     * Apply drive force to rear wheels
     */
    applyDriveForce(vehicle, deltaTime) {
        const throttle = vehicle.state.throttle;
        if (throttle <= 0) return;

        const settings = vehicle.settings;
        const maxForce = settings.mass * 3; // Simple force calculation
        const force = throttle * maxForce;

        // Get forward direction
        const forward = vehicle.rootNode.getDirection ? 
            vehicle.rootNode.getDirection(BABYLON.Axis.Z).scale(-1) :
            new BABYLON.Vector3(0, 0, -1);

        // Apply force at center of mass
        if (vehicle.physicsBody.applyForce) {
            vehicle.physicsBody.applyForce(forward.scale(force), vehicle.rootNode.getAbsolutePosition());
        }
    }

    /**
     * Apply steering to front wheels
     */
    applySteering(vehicle, deltaTime) {
        const steering = vehicle.state.steering;
        const maxSteerAngle = 0.6; // ~35 degrees
        const targetAngle = steering * maxSteerAngle;

        // Update wheel collider steering
        vehicle.wheelColliders.forEach(collider => {
            if (collider.steering) {
                collider.steerAngle = targetAngle;
            }
        });

        // Apply steering torque to physics body (simplified)
        if (Math.abs(steering) > 0.01 && vehicle.state.speed > 1) {
            const steerTorque = steering * 2.0;
            const up = new BABYLON.Vector3(0, 1, 0);
            if (vehicle.physicsBody.applyImpulse) {
                // Simple steering model
            }
        }
    }

    /**
     * Apply braking
     */
    applyBraking(vehicle, deltaTime) {
        const brake = vehicle.state.brake;
        if (brake <= 0) return;

        // Apply opposing force
        if (vehicle.physicsBody.getLinearVelocity) {
            const velocity = vehicle.physicsBody.getLinearVelocity();
            const brakeForce = velocity.scale(-brake * 5);
            
            if (vehicle.physicsBody.applyImpulse) {
                vehicle.physicsBody.applyImpulse(brakeForce.scale(vehicle.settings.mass * deltaTime), 
                    vehicle.rootNode.getAbsolutePosition());
            }
        }
    }

    /**
     * Update visual wheels (sync with physics)
     */
    updateVisualWheels(vehicle, deltaTime) {
        const speed = vehicle.state.speed / 3.6; // km/h to m/s

        vehicle.visualWheels.forEach(wheel => {
            if (!wheel.mesh) return;

            // Calculate wheel rotation based on speed
            const wheelRadius = vehicle.settings.wheelRadius;
            if (wheelRadius > 0) {
                const angularVelocity = speed / wheelRadius;
                wheel.currentRotation += angularVelocity * deltaTime;
            }

            // Apply rotation around the correct axis
            const axis = wheel.rotationAxis;
            const rotation = BABYLON.Quaternion.RotationAxis(axis, wheel.currentRotation);

            // Apply steering to front wheels
            if (wheel.position === 'FL' || wheel.position === 'FR') {
                const steerQuat = BABYLON.Quaternion.RotationAxis(
                    new BABYLON.Vector3(0, 1, 0), 
                    vehicle.state.steering * 0.6
                );
                const combinedRotation = steerQuqaternion.multiply(rotation);
                wheel.mesh.rotationQuaternion = combinedRotation;
            } else {
                wheel.mesh.rotationQuaternion = rotation;
            }

            // Sync position with physics (suspension simulation)
            const collider = vehicle.wheelColliders.find(c => c.position === wheel.position);
            if (collider) {
                // Simple suspension: move wheel up/down based on ground contact
                // In real implementation, this would use raycasting
            }
        });
    }

    /**
     * Get vehicle state for network sync
     */
    getNetworkState(vehicle) {
        if (!vehicle || !vehicle.rootNode) return null;

        return {
            position: vehicle.rootNode.position.asArray(),
            rotation: vehicle.rootNode.rotationQuaternion ? 
                vehicle.rootNode.rotationQuaternion.asArray() : 
                [0, 0, 0, 1],
            velocity: vehicle.physicsBody?.getLinearVelocity()?.asArray() || [0, 0, 0],
            angularVelocity: vehicle.physicsBody?.getAngularVelocity()?.asArray() || [0, 0, 0],
            steering: vehicle.state.steering,
            throttle: vehicle.state.throttle,
            brake: vehicle.state.brake,
            speed: vehicle.state.speed,
            wheelRotations: vehicle.visualWheels.map(w => w.currentRotation)
        };
    }

    /**
     * Apply network state from remote player
     */
    applyNetworkState(vehicle, networkState) {
        if (!vehicle || !networkState) return;

        // Interpolate position
        const targetPos = new BABYLON.Vector3(...networkState.position);
        const targetRot = new BABYLON.Quaternion(...networkState.rotation);

        // Smooth interpolation
        vehicle.rootNode.position = BABYLON.Vector3.Lerp(
            vehicle.rootNode.position, 
            targetPos, 
            0.2
        );

        if (vehicle.rootNode.rotationQuaternion) {
            vehicle.rootNode.rotationQuaternion = BABYLON.Quaternion.Slerp(
                vehicle.rootNode.rotationQuaternion,
                targetRot,
                0.2
            );
        }

        // Update state
        vehicle.state.steering = networkState.steering;
        vehicle.state.throttle = networkState.throttle;
        vehicle.state.brake = networkState.brake;
        vehicle.state.speed = networkState.speed;

        // Update visual wheels
        if (networkState.wheelRotations) {
            vehicle.visualWheels.forEach((wheel, i) => {
                if (networkState.wheelRotations[i] !== undefined) {
                    wheel.currentRotation = networkState.wheelRotations[i];
                }
            });
        }
    }

    /**
     * Dispose vehicle
     */
    disposeVehicle(vehicleId) {
        const vehicle = this.vehicles.get(vehicleId);
        if (vehicle) {
            if (vehicle.physicsBody) {
                vehicle.physicsBody.dispose();
            }
            this.vehicles.delete(vehicleId);
        }
    }

    /**
     * Get all vehicles
     */
    getAllVehicles() {
        return Array.from(this.vehicles.values());
    }
}

window.VehicleAdapter = VehicleAdapter;
