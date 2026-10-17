/**
 * GLBImporter - Handles loading and processing of GLB/GLTF files
 */
class GLBImporter {
    constructor(scene, engine) {
        this.scene = scene;
        this.engine = engine;
        this.loadingQueue = [];
        this.isLoading = false;
        this.assetCache = new Map(); // Cache loaded assets by hash
    }

    /**
     * Load a GLB file from File object (user import)
     */
    async loadFromFile(file) {
        return ErrorHandler.safeAsync(async () => {
            const url = URL.createObjectURL(file);
            const fileName = file.name;
            
            // Generate unique mod ID from filename + size
            const modId = this.generateModId(fileName, file.size);
            
            // Check cache
            if (this.assetCache.has(modId)) {
                console.log(`Mod ${modId} already cached, reusing.`);
                URL.revokeObjectURL(url);
                return this.assetCache.get(modId);
            }

            // Show loading
            this.showLoading(`Loading ${fileName}...`);

            try {
                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '', 
                    url, 
                    '', 
                    this.scene,
                    null, // progress callback
                    '.glb'
                );

                URL.revokeObjectURL(url);

                // Process loaded meshes
                const modData = await this.processLoadedMeshes(result, modId, fileName);
                
                // Cache the result
                this.assetCache.set(modId, modData);
                
                this.hideLoading();
                return modData;

            } catch (error) {
                URL.revokeObjectURL(url);
                this.hideLoading();
                throw new Error(`Unable to load this GLB: ${fileName}`);
            }
        }, 'GLBImporter.loadFromFile');
    }

    /**
     * Load GLB from URL
     */
    async loadFromURL(url, modId = null) {
        return ErrorHandler.safeAsync(async () => {
            if (!modId) {
                modId = this.generateModId(url, 0);
            }

            if (this.assetCache.has(modId)) {
                return this.assetCache.get(modId);
            }

            this.showLoading(`Loading mod...`);

            try {
                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '', url, '', this.scene
                );

                const modData = await this.processLoadedMeshes(result, modId, url);
                this.assetCache.set(modId, modData);
                this.hideLoading();
                return modData;

            } catch (error) {
                this.hideLoading();
                throw new Error('Unable to load this GLB.');
            }
        }, 'GLBImporter.loadFromURL');
    }

    /**
     * Process loaded meshes and create mod data structure
     */
    async processLoadedMeshes(result, modId, sourceName) {
        const meshes = result.meshes;
        const particleSystems = result.particleSystems;
        const animationGroups = result.animationGroups;
        const skeletons = result.skeletons;

        if (!meshes || meshes.length === 0) {
            throw new Error('No meshes found in GLB file.');
        }

        // Create root node
        const rootNode = new BABYLON.TransformNode(`mod_root_${modId}`, this.scene);
        
        // Parent all meshes to root
        meshes.forEach(mesh => {
            if (mesh.parent === null) {
                mesh.parent = rootNode;
            }
        });

        // Calculate bounding box
        const boundingInfo = this.calculateBoundingBox(meshes);
        
        // Calculate dimensions
        const dimensions = {
            x: boundingInfo.max.x - boundingInfo.min.x,
            y: boundingInfo.max.y - boundingInfo.min.y,
            z: boundingInfo.max.z - boundingInfo.min.z
        };

        // Auto-correct scale if too small or too large
        const scale = this.autoCorrectScale(dimensions);
        rootNode.scaling = new BABYLON.Vector3(scale, scale, scale);

        // Detect orientation
        const orientation = this.detectOrientation(meshes, dimensions);

        // Generate mod data
        const modData = {
            modId: modId,
            sourceName: sourceName,
            rootNode: rootNode,
            meshes: meshes,
            particleSystems: particleSystems,
            animationGroups: animationGroups,
            skeletons: skeletons,
            boundingBox: boundingInfo,
            dimensions: {
                x: dimensions.x * scale,
                y: dimensions.y * scale,
                z: dimensions.z * scale
            },
            scale: scale,
            orientation: orientation,
            nodes: this.buildNodeHierarchy(meshes),
            metadata: this.extractMetadata(result),
            hash: await this.computeHash(sourceName),
            loadedAt: Date.now()
        };

        // Load saved settings if available
        const savedSettings = ModSettings.getModSettings(modId);
        if (savedSettings) {
            modData.savedSettings = savedSettings;
            this.applySavedSettings(modData, savedSettings);
        }

        return modData;
    }

    /**
     * Calculate bounding box for all meshes
     */
    calculateBoundingBox(meshes) {
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        meshes.forEach(mesh => {
            mesh.computeWorldMatrix(true);
            const boundingInfo = mesh.getBoundingInfo();
            
            if (boundingInfo) {
                const meshMin = boundingInfo.boundingBox.minimumWorld;
                const meshMax = boundingInfo.boundingBox.maximumWorld;
                
                min = BABYLON.Vector3.Minimize(min, meshMin);
                max = BABYLON.Vector3.Maximize(max, meshMax);
            }
        });

        return { min, max };
    }

    /**
     * Auto-correct scale based on dimensions
     */
    autoCorrectScale(dimensions) {
        const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
        
        // If model is in centimeters (very large numbers)
        if (maxDim > 100) {
            return 0.01; // cm to meters
        }
        // If model is in millimeters
        if (maxDim > 1000) {
            return 0.001; // mm to meters
        }
        // If model is extremely small
        if (maxDim < 0.01) {
            return 100;
        }
        // If model is extremely large (already in reasonable units)
        if (maxDim > 50) {
            return 0.1;
        }
        
        return 1.0; // Already in meters
    }

    /**
     * Detect model orientation (which direction is front)
     */
    detectOrientation(meshes, dimensions) {
        // Heuristic: front is usually -Z in most 3D formats
        // But some use +Z, +X, or -X
        // We check if the model extends more in one direction
        
        const center = {
            x: (dimensions.x) / 2,
            y: (dimensions.y) / 2,
            z: (dimensions.z) / 2
        };

        // Default: -Z is forward (common in glTF)
        return {
            forward: new BABYLON.Vector3(0, 0, -1),
            up: new BABYLON.Vector3(0, 1, 0),
            right: new BABYLON.Vector3(1, 0, 0)
        };
    }

    /**
     * Build node hierarchy from meshes
     */
    buildNodeHierarchy(meshes) {
        const nodes = [];
        
        meshes.forEach(mesh => {
            nodes.push({
                name: mesh.name,
                uniqueName: mesh.uniqueName,
                parentName: mesh.parent ? mesh.parent.name : null,
                position: mesh.position.clone(),
                rotation: mesh.rotation.clone(),
                scaling: mesh.scaling.clone(),
                children: mesh.getChildren().map(c => c.name),
                metadata: mesh.metadata || null
            });
        });

        return nodes;
    }

    /**
     * Extract metadata from loaded result
     */
    extractMetadata(result) {
        const metadata = {};
        
        if (result.meshes) {
            result.meshes.forEach(mesh => {
                if (mesh.metadata) {
                    metadata[mesh.name] = mesh.metadata;
                }
            });
        }

        return metadata;
    }

    /**
     * Generate unique mod ID
     */
    generateModId(fileName, fileSize) {
        const clean = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `mod_${clean}_${fileSize}_${Date.now().toString(36)}`;
    }

    /**
     * Compute hash for mod identification
     */
    async computeHash(source) {
        const encoder = new TextEncoder();
        const data = encoder.encode(source + Date.now());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * Apply saved settings to mod
     */
    applySavedSettings(modData, settings) {
        if (settings.scale) {
            modData.rootNode.scaling = new BABYLON.Vector3(settings.scale, settings.scale, settings.scale);
        }
        if (settings.rotation) {
            modData.rootNode.rotation = new BABYLON.Vector3(
                settings.rotation.x || 0,
                settings.rotation.y || 0,
                settings.rotation.z || 0
            );
        }
    }

    /**
     * Show loading indicator
     */
    showLoading(text) {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = document.getElementById('loading-text');
        if (loadingScreen) loadingScreen.classList.add('active');
        if (loadingText) loadingText.textContent = text;
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.remove('active');
    }

    /**
     * Dispose mod and free resources
     */
    disposeMod(modId) {
        const modData = this.assetCache.get(modId);
        if (modData) {
            if (modData.rootNode) {
                modData.rootNode.dispose();
            }
            if (modData.animationGroups) {
                modData.animationGroups.forEach(ag => ag.dispose());
            }
            this.assetCache.delete(modId);
        }
    }

    /**
     * Check if mod is already loaded
     */
    isModLoaded(modId) {
        return this.assetCache.has(modId);
    }

    /**
     * Get all loaded mods
     */
    getLoadedMods() {
        return Array.from(this.assetCache.entries()).map(([id, data]) => ({
            modId: id,
            name: data.sourceName,
            dimensions: data.dimensions,
            scale: data.scale
        }));
    }
}

window.GLBImporter = GLBImporter;
