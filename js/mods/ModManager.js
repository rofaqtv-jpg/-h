/**
 * ModManager - Central management for all mods
 */
class ModManager {
    constructor() {
        this.mods = new Map();
        this.importer = null;
        this.vehicleAdapter = null;
        this.mapAdapter = null;
    }

    /**
     * Initialize with references to other systems
     */
    init(scene, engine) {
        this.importer = new GLBImporter(scene, engine);
        this.vehicleAdapter = new VehicleAdapter(scene);
        this.mapAdapter = new MapAdapter(scene);
    }

    /**
     * Import a mod from file
     */
    async importMod(file, type = 'vehicle') {
        return ErrorHandler.safeAsync(async () => {
            // Load the GLB
            const modData = await this.importer.loadFromFile(file);
            
            if (!modData) {
                throw new Error('Unable to load this GLB.');
            }

            // Classify and adapt based on type
            if (type === 'map') {
                const map = await this.mapAdapter.createMap(modData);
                this.mods.set(modData.modId, {
                    ...modData,
                    type: 'map',
                    name: file.name,
                    adaptedData: map
                });
                return map;
            } else {
                const vehicle = await this.vehicleAdapter.createVehicle(modData);
                this.mods.set(modData.modId, {
                    ...modData,
                    type: 'vehicle',
                    name: file.name,
                    vehicleType: vehicle.type,
                    adaptedData: vehicle
                });
                return vehicle;
            }
        }, 'ModManager.importMod');
    }

    /**
     * Spawn a previously imported mod
     */
    async spawnMod(modId) {
        const mod = this.mods.get(modId);
        if (!mod) {
            ErrorHandler.showUserError('Mod not found.');
            return;
        }

        if (mod.type === 'vehicle') {
            // Attach camera to vehicle
            if (window.CameraAdapter && mod.adaptedData) {
                window.CameraAdapter.attachToVehicle(mod.adaptedData);
                mod.adaptedData.isLocal = true;
            }
        }
    }

    /**
     * Delete a mod
     */
    deleteMod(modId) {
        const mod = this.mods.get(modId);
        if (!mod) return;

        if (mod.type === 'vehicle') {
            this.vehicleAdapter.disposeVehicle(modId);
        } else if (mod.type === 'map') {
            this.mapAdapter.disposeMap(modId);
        }

        this.importer.disposeMod(modId);
        ModSettings.deleteModSettings(modId);
        this.mods.delete(modId);
    }

    /**
     * Check if a mod exists
     */
    hasMod(modId) {
        return this.mods.has(modId);
    }

    /**
     * Get all mods
     */
    getAllMods() {
        return Array.from(this.mods.values()).map(m => ({
            modId: m.modId,
            name: m.name,
            type: m.type,
            vehicleType: m.vehicleType || null,
            dimensions: m.dimensions
        }));
    }

    /**
     * Get mod by ID
     */
    getMod(modId) {
        return this.mods.get(modId);
    }
}

window.ModManager = new ModManager();
