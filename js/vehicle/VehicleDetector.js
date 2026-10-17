/**
 * VehicleDetector - Automatically detects vehicle components from GLB structure
 */
class VehicleDetector {
    constructor() {
        this.detectionPatterns = {
            wheels: [
                /wheel/i, /tire/i, /rim/i, /tyre/i,
                /fl|fr|rl|rr/i, /front.*left|front.*right|rear.*left|rear.*right/i,
                /wheel_fl|wheel_fr|wheel_rl|wheel_rr/i
            ],
            body: [
                /body/i, /chassis/i, /frame/i, /shell/i, /hull/i,
                /car/i, /vehicle/i
            ],
            steeringWheel: [
                /steering/i, /steer_wheel/i, /handlebar/i
            ],
            seat: [
                /seat/i, /driver/i, /cockpit/i
            ],
            headlight: [
                /headlight/i, /head_light/i, /lamp_front/i
            ],
            taillight: [
                /taillight/i, /tail_light/i, /rear_light/i
            ]
        };
    }

    /**
     * Detect all vehicle components from mod data
     */
    detect(modData) {
        const result = {
            vehicleType: this.detectVehicleType(modData),
            body: null,
            wheels: { FL: null, FR: null, RL: null, RR: null },
            wheelAxes: { FL: null, FR: null, RL: null, RR: null },
            steeringWheel: null,
            driverSeat: null,
            driverPosition: null,
            passengerPositions: [],
            centerOfMass: null,
            frontDirection: null,
            dimensions: modData.dimensions,
            groundHeight: 0,
            confidence: 0
        };

        const nodes = modData.nodes;
        const meshes = modData.meshes;

        // 1. Detect vehicle type from dimensions
        result.vehicleType = this.classifyVehicleType(modData.dimensions);

        // 2. Try to find wheels by name patterns
        this.detectWheelsByName(nodes, result);

        // 3. If wheels not found, try position-based detection
        if (!this.allWheelsFound(result)) {
            this.detectWheelsByPosition(meshes, modData.dimensions, result);
        }

        // 4. Detect body
        result.body = this.detectBody(nodes, meshes);

        // 5. Detect steering wheel
        result.steeringWheel = this.detectNodeByPattern(nodes, this.detectionPatterns.steeringWheel);

        // 6. Detect driver seat
        result.driverSeat = this.detectNodeByPattern(nodes, this.detectionPatterns.seat);

        // 7. Calculate driver position
        result.driverPosition = this.calculateDriverPosition(modData, result);

        // 8. Calculate center of mass
        result.centerOfMass = this.calculateCenterOfMass(modData, result);

        // 9. Determine front direction
        result.frontDirection = modData.orientation.forward;

        // 10. Calculate ground height
        result.groundHeight = this.calculateGroundHeight(modData);

        // 11. Calculate wheel axes
        this.calculateWheelAxes(result, modData);

        // 12. Calculate confidence score
        result.confidence = this.calculateConfidence(result);

        return result;
    }

    /**
     * Classify vehicle type based on dimensions
     */
    classifyVehicleType(dimensions) {
        const { x: width, y: height, z: length } = dimensions;
        const ratio = length / width;

        // Bicycle: very narrow, low
        if (width < 0.8 && height < 1.5) return 'bicycle';
        
        // Motorcycle: narrow, medium height
        if (width < 1.2 && height < 1.8) return 'motorcycle';
        
        // Bus: very long and tall
        if (length > 8 && height > 2.5) return 'bus';
        
        // Truck: long and tall
        if (length > 5 && height > 2) return 'truck';
        
        // Airplane: very long wingspan or very long
        if (width > 10 || (length > 10 && height > 2)) return 'airplane';
        
        // Default: car
        return 'car';
    }

    /**
     * Detect wheels by node name patterns
     */
    detectWheelsByName(nodes, result) {
        const wheelPositions = {
            FL: { name: ['fl', 'front_left', 'front left', 'wheel_fl', 'lf'], x: -1, z: 1 },
            FR: { name: ['fr', 'front_right', 'front right', 'wheel_fr', 'rf'], x: 1, z: 1 },
            RL: { name: ['rl', 'rear_left', 'rear left', 'wheel_rl', 'lr'], x: -1, z: -1 },
            RR: { name: ['rr', 'rear_right', 'rear right', 'wheel_rr', 'lr'], x: 1, z: -1 }
        };

        for (const node of nodes) {
            const name = node.name.toLowerCase();
            
            for (const [pos, pattern] of Object.entries(wheelPositions)) {
                if (result.wheels[pos]) continue; // Already found
                
                for (const keyword of pattern.name) {
                    if (name.includes(keyword)) {
                        // Verify it's roughly in the correct position
                        if (this.isWheelPositionCorrect(node, pos)) {
                            result.wheels[pos] = {
                                nodeName: node.name,
                                position: node.position,
                                node: node
                            };
                        }
                        break;
                    }
                }
            }
        }
    }

    /**
     * Check if a node is in the correct wheel position
     */
    isWheelPositionCorrect(node, expectedPos) {
        const pos = node.position;
        const isLeft = pos.x < 0;
        const isFront = pos.z < 0; // Assuming -Z is forward

        switch (expectedPos) {
            case 'FL': return isLeft && isFront;
            case 'FR': return !isLeft && isFront;
            case 'RL': return isLeft && !isFront;
            case 'RR': return !isLeft && !isFront;
        }
        return false;
    }

    /**
     * Detect wheels by position when names don't match
     */
    detectWheelsByPosition(meshes, dimensions, result) {
        // Find cylindrical/spherical objects near the bottom of the vehicle
        const candidates = [];
        
        meshes.forEach(mesh => {
            const worldPos = mesh.getAbsolutePosition();
            const bounds = mesh.getBoundingInfo();
            
            if (!bounds) return;
            
            const size = {
                x: bounds.boundingBox.maximumWorld.x - bounds.boundingBox.minimumWorld.x,
                y: bounds.boundingBox.maximumWorld.y - bounds.boundingBox.minimumWorld.y,
                z: bounds.boundingBox.maximumWorld.z - bounds.boundingBox.minimumWorld.z
            };

            // Wheel heuristic: roughly circular cross-section, near ground
            const isWheelLike = (
                Math.abs(size.x - size.z) < size.x * 0.4 && // roughly circular
                size.y < dimensions.y * 0.6 && // not too tall
                worldPos.y < dimensions.y * 0.4 && // near the bottom
                size.x > dimensions.x * 0.1 // not too small
            );

            if (isWheelLike) {
                candidates.push({
                    mesh: mesh,
                    position: worldPos.clone(),
                    size: size
                });
            }
        });

        // Sort candidates and assign to positions
        if (candidates.length >= 2) {
            this.assignWheelsByPosition(candidates, dimensions, result);
        }
    }

    /**
     * Assign detected wheel candidates to FL/FR/RL/RR positions
     */
    assignWheelsByPosition(candidates, dimensions, result) {
        // Sort by X position (left/right) and Z position (front/rear)
        const centerX = 0;
        const centerZ = 0;

        const left = candidates.filter(c => c.position.x < centerX).sort((a, b) => a.position.z - b.position.z);
        const right = candidates.filter(c => c.position.x >= centerX).sort((a, b) => a.position.z - b.position.z);

        // Assign front/rear
        if (left.length >= 2) {
            result.wheels.FL = { position: left[0].position, mesh: left[0].mesh };
            result.wheels.RL = { position: left[left.length - 1].position, mesh: left[left.length - 1].mesh };
        } else if (left.length === 1) {
            // Determine if front or rear based on Z
            if (left[0].position.z < centerZ) {
                result.wheels.FL = { position: left[0].position, mesh: left[0].mesh };
            } else {
                result.wheels.RL = { position: left[0].position, mesh: left[0].mesh };
            }
        }

        if (right.length >= 2) {
            result.wheels.FR = { position: right[0].position, mesh: right[0].mesh };
            result.wheels.RR = { position: right[right.length - 1].position, mesh: right[right.length - 1].mesh };
        } else if (right.length === 1) {
            if (right[0].position.z < centerZ) {
                result.wheels.FR = { position: right[0].position, mesh: right[0].mesh };
            } else {
                result.wheels.RR = { position: right[0].position, mesh: right[0].mesh };
            }
        }
    }

    /**
     * Check if all 4 wheels are found
     */
    allWheelsFound(result) {
        return result.wheels.FL && result.wheels.FR && result.wheels.RL && result.wheels.RR;
    }

    /**
     * Detect body mesh
     */
    detectBody(nodes, meshes) {
        // First try by name
        const bodyNode = this.detectNodeByPattern(nodes, this.detectionPatterns.body);
        if (bodyNode) return bodyNode;

        // Otherwise, use the largest mesh as body
        let largestMesh = null;
        let largestVolume = 0;

        meshes.forEach(mesh => {
            const bounds = mesh.getBoundingInfo();
            if (!bounds) return;
            
            const size = bounds.boundingBox.maximumWorld.subtract(bounds.boundingBox.minimumWorld);
            const volume = size.x * size.y * size.z;
            
            if (volume > largestVolume) {
                largestVolume = volume;
                largestMesh = mesh;
            }
        });

        return largestMesh ? { name: largestMesh.name, mesh: largestMesh } : null;
    }

    /**
     * Detect node by name pattern
     */
    detectNodeByPattern(nodes, patterns) {
        for (const node of nodes) {
            const name = node.name.toLowerCase();
            for (const pattern of patterns) {
                if (name.match(pattern)) {
                    return { name: node.name, node: node };
                }
            }
        }
        return null;
    }

    /**
     * Calculate driver position
     */
    calculateDriverPosition(modData, detectionResult) {
        if (detectionResult.driverSeat) {
            const seatNode = detectionResult.driverSeat.node;
            if (seatNode && seatNode.position) {
                return new BABYLON.Vector3(
                    seatNode.position.x,
                    seatNode.position.y + 0.6, // Above seat
                    seatNode.position.z
                );
            }
        }

        // Fallback: calculate from dimensions
        const dims = modData.dimensions;
        const isLeftHandDrive = true; // Default assumption
        
        return new BABYLON.Vector3(
            isLeftHandDrive ? -dims.x * 0.2 : dims.x * 0.2,
            dims.y * 0.55,
            -dims.z * 0.1
        );
    }

    /**
     * Calculate center of mass
     */
    calculateCenterOfMass(modData, detectionResult) {
        const dims = modData.dimensions;
        
        // Center of mass is typically slightly below geometric center
        // and slightly towards the front for most vehicles
        return new BABYLON.Vector3(
            0,
            dims.y * 0.35,
            -dims.z * 0.05
        );
    }

    /**
     * Calculate ground height (bottom of vehicle to ground)
     */
    calculateGroundHeight(modData) {
        return modData.boundingBox.min.y;
    }

    /**
     * Calculate wheel rotation axes
     */
    calculateWheelAxes(result, modData) {
        // Default: wheels rotate around X axis (lateral axis)
        const defaultAxis = new BABYLON.Vector3(1, 0, 0);
        
        for (const pos of ['FL', 'FR', 'RL', 'RR']) {
            if (result.wheels[pos] && result.wheels[pos].mesh) {
                // Try to detect axis from mesh orientation
                const mesh = result.wheels[pos].mesh;
                if (mesh.rotation) {
                    // If mesh is rotated, the spin axis might be different
                    result.wheelAxes[pos] = this.detectWheelAxis(mesh);
                } else {
                    result.wheelAxes[pos] = defaultAxis.clone();
                }
            } else {
                result.wheelAxes[pos] = defaultAxis.clone();
            }
        }
    }

    /**
     * Detect the rotation axis of a wheel mesh
     */
    detectWheelAxis(mesh) {
        // Analyze mesh geometry to find the rotation axis
        // For a wheel, the rotation axis is perpendicular to the flat face
        // In most cases it's the X axis (lateral)
        
        // Check if the mesh has any metadata about axis
        if (mesh.metadata && mesh.metadata.rotationAxis) {
            return new BABYLON.Vector3(
                mesh.metadata.rotationAxis.x || 1,
                mesh.metadata.rotationAxis.y || 0,
                mesh.metadata.rotationAxis.z || 0
            );
        }

        // Default to X axis
        return new BABYLON.Vector3(1, 0, 0);
    }

    /**
     * Calculate detection confidence (0-1)
     */
    calculateConfidence(result) {
        let score = 0;
        let maxScore = 0;

        // Wheels (40% of confidence)
        maxScore += 40;
        const wheelsFound = Object.values(result.wheels).filter(w => w !== null).length;
        score += (wheelsFound / 4) * 40;

        // Body (20%)
        maxScore += 20;
        if (result.body) score += 20;

        // Steering wheel (15%)
        maxScore += 15;
        if (result.steeringWheel) score += 15;

        // Driver position (15%)
        maxScore += 15;
        if (result.driverPosition) score += 15;

        // Vehicle type (10%)
        maxScore += 10;
        if (result.vehicleType) score += 10;

        return score / maxScore;
    }

    /**
     * Detect vehicle type from dimensions (public method)
     */
    detectVehicleType(modData) {
        return this.classifyVehicleType(modData.dimensions);
    }
}

window.VehicleDetector = new VehicleDetector();
