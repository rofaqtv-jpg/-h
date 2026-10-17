/**
 * PerformanceOptimizer - Manages performance-critical operations
 */
class PerformanceOptimizer {
    constructor() {
        this.objectPool = new Map();
        this.assetCache = new Map();
        this.lodDistances = {
            high: 50,
            medium: 150,
            low: 300
        };
        this.cullDistance = 500;
        this.frameBudget = 16.67; // 60fps target
        this.lastFrameTime = 0;
    }

    /**
     * Object Pool for reusable objects
     */
    createPool(key, factory, initialSize = 5) {
        if (!this.objectPool.has(key)) {
            const pool = {
                factory: factory,
                available: [],
                inUse: new Set()
            };
            
            for (let i = 0; i < initialSize; i++) {
                pool.available.push(factory());
            }
            
            this.objectPool.set(key, pool);
        }
        return this.objectPool.get(key);
    }

    acquire(key) {
        const pool = this.objectPool.get(key);
        if (!pool) return null;
        
        let obj = pool.available.pop();
        if (!obj) {
            obj = pool.factory();
        }
        pool.inUse.add(obj);
        return obj;
    }

    release(key, obj) {
        const pool = this.objectPool.get(key);
        if (!pool) return;
        
        pool.inUse.delete(obj);
        pool.available.push(obj);
    }

    /**
     * Asset Cache
     */
    cacheAsset(url, asset) {
        this.assetCache.set(url, {
            asset: asset,
            timestamp: Date.now(),
            refCount: 1
        });
    }

    getCachedAsset(url) {
        const entry = this.assetCache.get(url);
        if (entry) {
            entry.refCount++;
            return entry.asset;
        }
        return null;
    }

    releaseAsset(url) {
        const entry = this.assetCache.get(url);
        if (entry) {
            entry.refCount--;
            if (entry.refCount <= 0) {
                this.assetCache.delete(url);
            }
        }
    }

    /**
     * LOD Management
     */
    updateLOD(camera, meshes) {
        const cameraPos = camera.position;
        
        for (const mesh of meshes) {
            if (!mesh.position) continue;
            
            const distance = BABYLON.Vector3.Distance(cameraPos, mesh.position);
            
            if (distance > this.cullDistance) {
                mesh.isEnabled = false;
            } else {
                mesh.isEnabled = true;
                
                if (distance < this.lodDistances.high) {
                    mesh_LOD_select(mesh, 0); // High detail
                } else if (distance < this.lodDistances.medium) {
                    mesh_LOD_select(mesh, 1); // Medium
                } else {
                    mesh_LOD_select(mesh, 2); // Low
                }
            }
        }
    }

    /**
     * Throttle function for network updates
     */
    throttle(fn, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    }

    /**
     * Debounce function
     */
    debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Frustum culling check
     */
    isInFrustum(mesh, camera) {
        if (!mesh.getBoundingInfo) return true;
        
        const boundingInfo = mesh.getBoundingInfo();
        const frustumPlanes = camera.getFrustumPlanes();
        
        return BABYLON.Geometry.Frustum.IsBoundingSphereInFrustum(
            boundingInfo.boundingSphere.centerWorld,
            boundingInfo.boundingSphere.radiusWorld,
            frustumPlanes
        );
    }

    /**
     * Memory cleanup
     */
    disposeAsset(asset) {
        if (!asset) return;
        
        try {
            if (asset.dispose) {
                asset.dispose();
            }
            if (asset.meshes) {
                asset.meshes.forEach(m => m.dispose());
            }
            if (asset.particleSystems) {
                asset.particleSystems.forEach(ps => ps.dispose());
            }
        } catch (e) {
            console.warn('Cleanup error:', e);
        }
    }

    /**
     * Get performance stats
     */
    getStats(engine) {
        return {
            fps: engine.getFps(),
            frameTime: engine.getDeltaTime(),
            drawCalls: engine._drawCalls?.current || 0,
            activeMeshes: engine.scenes?.[0]?.activeMeshes?.length || 0
        };
    }
}

function mesh_LOD_select(mesh, level) {
    if (mesh LOD && mesh.LOD.length > level) {
        // Babylon.js handles LOD internally
    }
}

window.PerformanceOptimizer = new PerformanceOptimizer();
