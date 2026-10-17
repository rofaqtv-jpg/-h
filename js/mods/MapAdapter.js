/**
 * MapAdapter - Handles importing and setting up GLB maps
 */
class MapAdapter {
    constructor(scene) {
        this.scene = scene;
        this.maps = new Map();
    }

    /**
     * Create a map from mod data
     */
    async createMap(modData) {
        return ErrorHandler.safeAsync(async () => {
            const rootNode = modData.rootNode;
            const meshes = modData.meshes;

            // Calculate map bounds
            const bounds = modData.boundingBox;
            const dimensions = modData.dimensions;

            // Create static physics for the map
            await this.createStaticPhysics(modData);

            // Setup LOD for performance
            this.setupLOD(modData);

            // Setup culling
            this.setupCulling(modData);

            // Optimize materials
            this.optimizeMaterials(modData);

            const mapData = {
                id: modData.modId,
                modData: modData,
                rootNode: rootNode,
                dimensions: dimensions,
                bounds: bounds,
                groundLevel: bounds.min.y,
                meshes: meshes
            };

            // Save settings
            const settings = ModSettings.getModSettings(modData.modId) || 
                ModSettings.createDefaultMapSettings();
            settings.modId = modData.modId;
            settings.dimensions = { x: dimensions.x, y: dimensions.y, z: dimensions.z };
            ModSettings.setModSettings(modData.modId, settings);

            this.maps.set(mapData.id, mapData);
            return mapData;
        }, 'MapAdapter.createMap');
    }

    /**
     * Create static physics colliders for the map
     */
    async createStaticPhysics(modData) {
        const meshes = modData.meshes;
        
        // Group small meshes into compound colliders for performance
        const groups = this.groupMeshesForPhysics(meshes);
        
        for (const group of groups) {
            if (group.meshes.length === 1) {
                // Single mesh - use convex hull or box
                const mesh = group.meshes[0];
                await this.createMeshCollider(mesh, 'static');
            } else {
                // Multiple small meshes - create compound collider
                await this.createCompoundCollider(group, 'static');
            }
        }

        // Create ground plane if needed
        this.createGroundCollider(modData);
    }

    /**
     * Group meshes for efficient physics
     */
    groupMeshesForPhysics(meshes) {
        const groups = [];
        const threshold = 2.0; // meters - meshes closer than this are grouped
        
        const ungrouped = [...meshes];
        
        while (ungrouped.length > 0) {
            const seed = ungrouped.pop();
            const group = { meshes: [seed], center: seed.getAbsolutePosition().clone() };
            
            // Find nearby meshes
            for (let i = ungrouped.length - 1; i >= 0; i--) {
                const mesh = ungrouped[i];
                const dist = BABYLON.Vector3.Distance(group.center, mesh.getAbsolutePosition());
                
                if (dist < threshold) {
                    group.meshes.push(mesh);
                    // Update center
                    const sum = group.meshes.reduce((acc, m) => acc.add(m.getAbsolutePosition()), BABYLON.Vector3.Zero());
                    group.center = sum.scale(1 / group.meshes.length);
                    ungrouped.splice(i, 1);
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }

    /**
     * Create collider for a single mesh
     */
    async createMeshCollider(mesh, type = 'static') {
        try {
            // Use convex hull for complex shapes, box for simple ones
            const bounds = mesh.getBoundingInfo();
            if (!bounds) return;
            
            const size = bounds.boundingBox.maximumWorld.subtract(bounds.boundingBox.minimumWorld);
            
            // If mesh is roughly box-shaped, use box collider (faster)
            const isBoxLike = (
                Math.abs(size.x - size.z) < Math.max(size.x, size.z) * 0.3 &&
                size.y < Math.max(size.x, size.z) * 0.5
            );

            if (isBoxLike || mesh.name.toLowerCase().includes('ground') || 
                mesh.name.toLowerCase().includes('floor') || mesh.name.toLowerCase().includes('wall')) {
                // Box collider
                mesh.physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, this.scene);
                mesh.physicsBody.shape = new BABYLON.PhysicsShapeBox(
                    BABYLON.Vector3.Zero(),
                    BABYLON.Quaternion.Identity(),
                    size,
                    this.scene
                );
            } else {
                // Convex hull for complex shapes
                mesh.physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, this.scene);
                mesh.physicsBody.shape = new BABYLON.PhysicsShapeMesh(mesh, this.scene);
            }

            mesh.physicsBody.setMassProperties({ mass: 0 }); // Static
        } catch (e) {
            console.warn(`Failed to create collider for ${mesh.name}:`, e);
        }
    }

    /**
     * Create compound collider for a group of meshes
     */
    async createCompoundCollider(group, type = 'static') {
        try {
            // Create a single physics body for the group
            const rootNode = group.meshes[0].parent || group.meshes[0];
            
            // Use the first mesh as the physics host
            const hostMesh = group.meshes.reduce((largest, m) => {
                const b = m.getBoundingInfo();
                const s = b ? b.boundingBox.maximumWorld.subtract(b.boundingBox.minimumWorld) : BABYLON.Vector3.Zero();
                const lSize = largest.getBoundingInfo()?.boundingBox?.maximumWorld?.subtract(largest.getBoundingInfo()?.boundingBox?.minimumWorld);
                const lVol = lSize ? lSize.x * lSize.y * lSize.z : 0;
                return (s.x * s.y * s.z) > lVol ? m : largest;
            }, group.meshes[0]);

            hostMesh.physicsBody = new BABYLON.PhysicsBody(hostMesh, BABYLON.PhysicsMotionType.STATIC, false, this.scene);
            
            // Create compound shape from all meshes in group
            const shapes = [];
            for (const mesh of group.meshes) {
                const bounds = mesh.getBoundingInfo();
                if (!bounds) continue;
                
                const size = bounds.boundingBox.maximumWorld.subtract(bounds.boundingBox.minimumWorld);
                const center = bounds.boundingBox.centerWorld.subtract(hostMesh.getAbsolutePosition());
                
                const subShape = new BABYLON.PhysicsShapeBox(
                    center,
                    BABYLON.Quaternion.Identity(),
                    size,
                    this.scene
                );
                shapes.push(subShape);
            }

            if (shapes.length > 0) {
                hostMesh.physicsBody.shape = new BABYLON.PhysicsShapeContainer(shapes, this.scene);
                hostMesh.physicsBody.setMassProperties({ mass: 0 });
            }
        } catch (e) {
            console.warn('Failed to create compound collider:', e);
        }
    }

    /**
     * Create ground collider
     */
    createGroundCollider(modData) {
        // Check if there's already a ground mesh
        const hasGround = modData.meshes.some(m => 
            m.name.toLowerCase().includes('ground') || 
            m.name.toLowerCase().includes('floor') ||
            m.name.toLowerCase().includes('terrain')
        );

        if (!hasGround) {
            // Create invisible ground plane
            const ground = BABYLON.MeshBuilder.CreateGround('map_ground', {
                width: modData.dimensions.x * 1.5,
                height: modData.dimensions.z * 1.5
            }, this.scene);
            
            ground.position.y = modData.boundingBox.min.y;
            ground.isVisible = false;
            ground.isPickable = false;
            
            ground.physicsBody = new BABYLON.PhysicsBody(ground, BABYLON.PhysicsMotionType.STATIC, false, this.scene);
            ground.physicsBody.shape = new BABYLON.PhysicsShapeBox(
                BABYLON.Vector3.Zero(),
                BABYLON.Quaternion.Identity(),
                new BABYLON.Vector3(modData.dimensions.x * 1.5, 0.1, modData.dimensions.z * 1.5),
                this.scene
            );
            ground.physicsBody.setMassProperties({ mass: 0 });
        }
    }

    /**
     * Setup LOD for map meshes
     */
    setupLOD(modData) {
        modData.meshes.forEach(mesh => {
            // Add LOD levels if mesh has enough vertices
            if (mesh.getTotalVertices && mesh.getTotalVertices() > 1000) {
                mesh.addLODLevel(100, mesh); // Could create lower-res versions
                mesh.addLODLevel(200, null); // Cull at distance
            }
        });
    }

    /**
     * Setup frustum culling
     */
    setupCulling(modData) {
        modData.meshes.forEach(mesh => {
            mesh.alwaysSelectAsActiveMesh = false;
            // Babylon.js handles frustum culling by default
            // We can optimize by setting appropriate bounding info
            if (mesh.getBoundingInfo) {
                mesh.getBoundingInfo(); // Force computation
            }
        });
    }

    /**
     * Optimize materials (share materials where possible)
     */
    optimizeMaterials(modData) {
        const materialMap = new Map();
        
        modData.meshes.forEach(mesh => {
            if (mesh.material) {
                const key = mesh.material.name || mesh.material.id;
                if (materialMap.has(key)) {
                    mesh.material = materialMap.get(key);
                } else {
                    materialMap.set(key, mesh.material);
                    // Freeze material for performance
                    if (mesh.material.freeze) {
                        mesh.material.freeze();
                    }
                }
            }
        });
    }

    /**
     * Dispose map
     */
    disposeMap(mapId) {
        const map = this.maps.get(mapId);
        if (map) {
            map.meshes.forEach(m => {
                if (m.physicsBody) m.physicsBody.dispose();
            });
            if (map.rootNode) map.rootNode.dispose();
            this.maps.delete(mapId);
        }
    }
}

window.MapAdapter = MapAdapter;
