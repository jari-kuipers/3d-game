import * as THREE from 'three';

/**
 * Manages animal entities including network synchronization, 
 * position/rotation interpolation, and terrain alignment
 */
export class AnimalManager {
    constructor(scene, terrainRenderer, entityRenderer) {
        this.scene = scene;
        this.terrain = terrainRenderer;
        this.entityRenderer = entityRenderer;
        this.animals = {};
        this.LERP_FACTOR_BASE = 10.0;
    }

    /**
     * Handle animal update from network (create or update)
     * @param {Object} data - Animal data {id, x, y, z, rotation}
     */
    handleAnimalUpdate(data) {
        let mesh = this.animals[data.id];

        if (!mesh) {
            // Create new animal
            mesh = this.entityRenderer.createSheepMesh();
            this.scene.add(mesh);
            this.animals[data.id] = mesh;
            mesh.userData.targetPosition = new THREE.Vector3(data.x, data.y, data.z);
            mesh.userData.targetRotation = data.rotation || 0;
            mesh.position.copy(mesh.userData.targetPosition);
            mesh.rotation.y = mesh.userData.targetRotation;
            return;
        }

        // Update existing animal's target position/rotation
        if (!mesh.userData.targetPosition) {
            mesh.userData.targetPosition = new THREE.Vector3();
        }
        mesh.userData.targetPosition.set(data.x, data.y, data.z);
        mesh.userData.targetRotation = data.rotation || 0;
    }

    /**
     * Handle initial animals list from server
     * @param {Object} animalsData - Map of animal ID to animal data
     */
    handleInitialAnimals(animalsData) {
        Object.values(animalsData).forEach(data => {
            this.handleAnimalUpdate(data);
        });
    }

    /**
     * Update all animals - call this in animation loop
     * @param {number} delta - Time delta in seconds
     */
    update(delta) {
        const LERP_FACTOR = this.LERP_FACTOR_BASE * delta;

        Object.values(this.animals).forEach(mesh => {
            // Position interpolation
            if (mesh.userData.targetPosition) {
                mesh.position.lerp(mesh.userData.targetPosition, LERP_FACTOR);
            }

            // Rotation interpolation with angle wrapping
            if (mesh.userData.targetRotation !== undefined) {
                // Initialize current yaw if needed
                if (mesh.userData.currentYaw === undefined) {
                    mesh.userData.currentYaw = mesh.rotation.y;
                }

                let current = mesh.userData.currentYaw;
                let target = mesh.userData.targetRotation;

                // Handle angle wrapping (shortest path)
                if (target - current > Math.PI) target -= Math.PI * 2;
                if (target - current < -Math.PI) target += Math.PI * 2;

                mesh.userData.currentYaw += (target - current) * LERP_FACTOR;

                // Align to terrain normal for realistic slope walking
                const normal = this.terrain.getNormal(mesh.position.x, mesh.position.z);
                const currentUp = new THREE.Vector3(0, 1, 0);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(currentUp, normal);
                const qYaw = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    mesh.userData.currentYaw
                );
                mesh.quaternion.multiplyQuaternions(quaternion, qYaw);
            }
        });
    }

    /**
     * Get all animal meshes (for collision detection, etc)
     * @returns {Object} Map of animal ID to mesh
     */
    getAnimals() {
        return this.animals;
    }

    /**
     * Remove a specific animal
     * @param {string} id - Animal ID
     */
    removeAnimal(id) {
        if (this.animals[id]) {
            this.scene.remove(this.animals[id]);
            delete this.animals[id];
        }
    }

    /**
     * Clear all animals
     */
    clear() {
        Object.values(this.animals).forEach(mesh => this.scene.remove(mesh));
        this.animals = {};
    }
}
