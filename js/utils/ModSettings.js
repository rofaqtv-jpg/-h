/**
 * ModSettings - Save and load mod configurations
 */
class ModSettings {
    constructor() {
        this.storageKey = 'driving_sim_mod_settings';
        this.settings = this.load();
    }

    /**
     * Load settings from localStorage
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load mod settings:', e);
            return {};
        }
    }

    /**
     * Save settings to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save mod settings:', e);
        }
    }

    /**
     * Get settings for a specific mod
     */
    getModSettings(modId) {
        return this.settings[modId] || null;
    }

    /**
     * Save settings for a specific mod
     */
    setModSettings(modId, settings) {
        this.settings[modId] = {
            ...this.settings[modId],
            ...settings,
            lastModified: Date.now()
        };
        this.save();
    }

    /**
     * Update specific setting for a mod
     */
    updateModSetting(modId, key, value) {
        if (!this.settings[modId]) {
            this.settings[modId] = {};
        }
        this.settings[modId][key] = value;
        this.settings[modId].lastModified = Date.now();
        this.save();
    }

    /**
     * Delete mod settings
     */
    deleteModSettings(modId) {
        delete this.settings[modId];
        this.save();
    }

    /**
     * Get all mod IDs
     */
    getAllModIds() {
        return Object.keys(this.settings);
    }

    /**
     * Check if mod has saved settings
     */
    hasSettings(modId) {
        return !!this.settings[modId];
    }

    /**
     * Export all settings as JSON
     */
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings from JSON
     */
    importSettings(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.settings = { ...this.settings, ...imported };
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import settings:', e);
            return false;
        }
    }

    /**
     * Create default vehicle settings template
     */
    static createDefaultVehicleSettings() {
        return {
            modId: '',
            scale: 1.0,
            rotation: { x: 0, y: 0, z: 0 },
            vehicleType: 'car', // car, bus, truck, motorcycle, bicycle, airplane
            wheelNodes: {
                FL: null,
                FR: null,
                RL: null,
                RR: null
            },
            wheelAxes: {
                FL: { x: 1, y: 0, z: 0 },
                FR: { x: 1, y: 0, z: 0 },
                RL: { x: 1, y: 0, z: 0 },
                RR: { x: 1, y: 0, z: 0 }
            },
            wheelRadius: 0.35,
            driverPosition: { x: 0, y: 1.2, z: -0.3 },
            cockpitCamera: {
                position: { x: 0, y: 1.3, z: -0.2 },
                rotation: { x: 0, y: 0, z: 0 }
            },
            externalCamera: {
                distance: 5,
                height: 2.5,
                lag: 0.1,
                lookAtOffset: { x: 0, y: 1, z: 0 }
            },
            mass: 1500,
            centerOfMass: { x: 0, y: 0.5, z: 0 },
            collisionSettings: {
                friction: 0.7,
                restitution: 0.1,
                shape: 'box' // box, sphere, compound
            },
            dimensions: {
                length: 4.5,
                width: 1.8,
                height: 1.5
            },
            suspension: {
                stiffness: 50,
                damping: 5,
                restLength: 0.3,
                travel: 0.2
            }
        };
    }

    /**
     * Create default map settings template
     */
    static createDefaultMapSettings() {
        return {
            modId: '',
            scale: 1.0,
            rotation: { x: 0, y: 0, z: 0 },
            dimensions: { x: 0, y: 0, z: 0 },
            collisionType: 'static',
            useLOD: true,
            useCulling: true,
            groundLevel: 0
        };
    }
}

window.ModSettings = new ModSettings();
