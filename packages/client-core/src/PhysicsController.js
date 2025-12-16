import * as THREE from 'three';

/**
 * Handles player physics including movement, collision, and gravity
 */
export class PhysicsController {
    constructor(camera, controls, config = {}) {
        this.camera = camera;
        this.controls = controls;

        this.config = {
            gravity: config.gravity || 100.0,
            jumpForce: config.jumpForce || 30.0,
            movementSpeed: config.movementSpeed || 400.0,
            friction: config.friction || 10.0,
            playerHeight: config.playerHeight || 2.0,
            playerRadius: config.playerRadius || 1.0,
            ...config
        };

        this.velocity = new THREE.Vector3();
        this.canJump = false;
        this.collidables = []; // Array of {x, z, radius} for static objects
        this.dynamicCollidables = []; // Array of objects with .position property
        this.getTerrainHeight = null; // Function to get terrain height at (x, z)
    }

    /**
     * Set the terrain height function
     */
    setTerrainHeightFunction(fn) {
        this.getTerrainHeight = fn;
    }

    /**
     * Add collidable objects (trees, etc)
     */
    addCollidable(x, z, radius) {
        this.collidables.push({ x, z, radius });
    }

    /**
     * Clear all collidables
     */
    clearCollidables() {
        this.collidables = [];
    }

    /**
     * Set dynamic collidables (objects that move, like animals)
     * @param {Array} objects - Array of objects with .position property
     * @param {number} radius - Collision radius for these objects
     */
    setDynamicCollidables(objects, radius = 1.5) {
        this.dynamicCollidables = { objects, radius };
    }

    /**
     * Update physics for one frame
     */
    update(delta, inputDirection, inputManager) {
        // Apply friction
        this.velocity.x -= this.velocity.x * this.config.friction * delta;
        this.velocity.z -= this.velocity.z * this.config.friction * delta;

        // Apply gravity
        this.velocity.y -= this.config.gravity * delta;

        // Apply input to velocity
        if (inputDirection.z !== 0 || inputDirection.x !== 0) {
            this.velocity.z -= inputDirection.z * this.config.movementSpeed * delta;
            this.velocity.x -= inputDirection.x * this.config.movementSpeed * delta;
        }

        // Mobile look (if joystick is active)
        if (inputManager && inputManager.joystickLookVector) {
            const lookVec = inputManager.joystickLookVector;
            if (Math.abs(lookVec.x) > 0 || Math.abs(lookVec.y) > 0) {
                const LOOK_SPEED = 2.0;
                this.camera.rotation.y -= lookVec.x * LOOK_SPEED * delta;
                this.camera.rotation.x += lookVec.y * LOOK_SPEED * delta;
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            }
        }

        // Apply velocity to position
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);

        // Collision detection with collidables
        this.resolveCollisions();

        // Apply vertical velocity
        this.camera.position.y += (this.velocity.y * delta);

        // Terrain collision
        this.handleTerrainCollision(inputManager);
    }

    resolveCollisions() {
        const playerRadius = this.config.playerRadius;

        // Check collision with all static collidables (trees, etc)
        for (const obj of this.collidables) {
            const dx = this.camera.position.x - obj.x;
            const dz = this.camera.position.z - obj.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = playerRadius + obj.radius;

            if (dist < minDist && dist > 0.001) {
                // Collision! Push out along normal
                const overlap = minDist - dist;
                const nx = dx / dist;
                const nz = dz / dist;

                this.camera.position.x += nx * overlap;
                this.camera.position.z += nz * overlap;
            }
        }

        // Check collision with dynamic collidables (animals, etc)
        if (this.dynamicCollidables && this.dynamicCollidables.objects) {
            const { objects, radius } = this.dynamicCollidables;

            Object.values(objects).forEach(mesh => {
                if (!mesh || !mesh.position) return;

                const dx = this.camera.position.x - mesh.position.x;
                const dz = this.camera.position.z - mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const minDist = playerRadius + radius;

                if (dist < minDist && dist > 0.001) {
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const nz = dz / dist;

                    this.camera.position.x += nx * overlap;
                    this.camera.position.z += nz * overlap;
                }
            });
        }
    }

    handleTerrainCollision(inputManager) {
        if (!this.getTerrainHeight) return;

        const terrainH = this.getTerrainHeight(this.camera.position.x, this.camera.position.z);
        const playerHeight = this.config.playerHeight;

        if (this.camera.position.y < terrainH + playerHeight) {
            // Below terrain - snap up
            this.velocity.y = 0;
            this.camera.position.y = terrainH + playerHeight;
            this.canJump = true;

            // Handle jump
            if (inputManager && inputManager.canJump) {
                this.velocity.y = this.config.jumpForce;
                this.canJump = false;
                inputManager.canJump = false;
            }
        } else if (this.velocity.y <= 0 && this.camera.position.y < terrainH + playerHeight + 1.0) {
            // Close to ground with downward/no velocity - snap to ground (prevents slope hopping)
            this.velocity.y = 0;
            this.camera.position.y = terrainH + playerHeight;
            this.canJump = true;  // Allow jumping when on ground

            // Handle jump
            if (inputManager && inputManager.canJump) {
                this.velocity.y = this.config.jumpForce;
                this.canJump = false;
                inputManager.canJump = false;
            }
        } else {
            // Truly in air
            this.canJump = false;
        }
    }
}
