/**
 * SyncManager - Handles state synchronization between players
 */
class SyncManager {
    constructor() {
        this.remoteStates = new Map(); // playerId -> state
        this.interpolationBuffer = 100; // ms
        this.remoteVehicles = new Map();
    }

    /**
     * Apply remote state from another player
     */
    applyRemoteState(playerId, state) {
        // Store with timestamp for interpolation
        const entry = this.remoteStates.get(playerId) || { buffer: [], lastApplied: null };
        
        entry.buffer.push({
            state: state,
            timestamp: Date.now()
        });

        // Keep buffer small
        if (entry.buffer.length > 20) {
            entry.buffer.shift();
        }

        this.remoteStates.set(playerId, entry);

        // Update or create remote vehicle visualization
        this.updateRemoteVehicle(playerId, state);
    }

    /**
     * Update remote vehicle visualization
     */
    updateRemoteVehicle(playerId, state) {
        if (!window.VehicleAdapter) return;

        let vehicle = this.remoteVehicles.get(playerId);
        
        if (!vehicle) {
            // Create a simple representation for remote player
            vehicle = this.createRemoteVehicle(playerId, state);
            this.remoteVehicles.set(playerId, vehicle);
        }

        // Interpolate to target state
        if (vehicle.rootNode) {
            const targetPos = new BABYLON.Vector3(...state.position);
            const targetRot = new BABYLON.Quaternion(...state.rotation);

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
        }
    }

    /**
     * Create a simple vehicle mesh for remote player
     */
    createRemoteVehicle(playerId, state) {
        if (!window.GameEngine || !window.GameEngine.scene) return null;

        const scene = window.GameEngine.scene;
        
        // Create a simple box as placeholder
        const mesh = BABYLON.MeshBuilder.CreateBox(`remote_${playerId}`, {
            width: 2,
            height: 1.5,
            depth: 4.5
        }, scene);

        mesh.position = new BABYLON.Vector3(...state.position);
        
        // Add a colored material
        const mat = new BABYLON.StandardMaterial(`remote_mat_${playerId}`, scene);
        mat.diffuseColor = new BABYLON.Color3(
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5
        );
        mesh.material = mat;

        return {
            id: playerId,
            rootNode: mesh,
            state: state
        };
    }

    /**
     * Remove remote vehicle when player leaves
     */
    removeRemoteVehicle(playerId) {
        const vehicle = this.remoteVehicles.get(playerId);
        if (vehicle && vehicle.rootNode) {
            vehicle.rootNode.dispose();
        }
        this.remoteVehicles.delete(playerId);
        this.remoteStates.delete(playerId);
    }

    /**
     * Update all remote vehicles (called each frame)
     */
    update(deltaTime) {
        // Interpolation happens in updateRemoteVehicle
    }

    /**
     * Get all remote vehicles
     */
    getAllRemoteVehicles() {
        return Array.from(this.remoteVehicles.values());
    }
}

window.SyncManager = new SyncManager();
