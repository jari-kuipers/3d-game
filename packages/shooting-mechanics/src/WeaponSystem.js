import * as THREE from 'three';

const PROJECTILE_SPEED = 50;

/**
 * Weapon system for FPS game - handles shooting, hit detection, and projectiles
 */
export class WeaponSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.projectiles = [];
    }

    /**
     * Fire a shot - performs raycasting for hit detection and creates visual projectile
     * @param {Object} controls - PointerLockControls instance
     * @param {Object} remotePlayers - Map of player ID to mesh
     * @param {Object} networkClient - NetworkClient instance
     * @returns {string|null} - ID of hit player, or null if no hit
     */
    shoot(controls, remotePlayers, networkClient) {
        // 1. Create visual projectile
        this.visualizeShot(this.camera.position, this.camera.quaternion, true, controls);

        // 2. Emit network event
        networkClient.emit('shoot');

        // 3. Hit detection (client-side authoritative)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera); // Center of screen

        // Check intersection with remote players
        const intersects = raycaster.intersectObjects(Object.values(remotePlayers));

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hitId = Object.keys(remotePlayers).find(id => remotePlayers[id] === hitMesh);

            if (hitId) {
                console.log("Hit player:", hitId);
                networkClient.emit('playerHit', hitId);
                return hitId;
            }
        }

        return null;
    }

    /**
     * Create a visual projectile
     * @param {THREE.Vector3} origin - Starting position
     * @param {THREE.Quaternion|Object} rotationOrQuaternion - Rotation (quaternion or euler object)
     * @param {boolean} isLocal - Whether this is the local player's shot
     * @param {Object} controls - PointerLockControls (for local shots)
     */
    visualizeShot(origin, rotationOrQuaternion, isLocal = false, controls = null) {
        const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

        projectile.position.copy(origin);

        const direction = new THREE.Vector3(0, 0, -1);

        if (rotationOrQuaternion.isQuaternion) {
            direction.applyQuaternion(rotationOrQuaternion);
        } else {
            // Remote players send Euler y rotation + x pitch
            const pitch = rotationOrQuaternion._x || 0;
            const yaw = rotationOrQuaternion._y || 0;
            const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
            direction.set(0, 0, -1).applyEuler(euler);
        }

        // For local shots, use controls direction
        if (isLocal && controls) {
            const d = new THREE.Vector3();
            controls.getDirection(d);
            direction.copy(d);
        }

        // Offset projectile forward from origin
        projectile.position.addScaledVector(direction, 2);

        // Store velocity in userData
        projectile.userData = {
            velocity: direction.multiplyScalar(PROJECTILE_SPEED)
        };

        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    /**
     * Update all projectiles - call this in animation loop
     * @param {number} delta - Time delta in seconds
     */
    update(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.position.addScaledVector(p.userData.velocity, delta);

            // Remove projectiles that are too far away
            if (p.position.length() > 2000) {
                this.scene.remove(p);
                this.projectiles.splice(i, 1);
            }
        }
    }

    /**
     * Clear all projectiles
     */
    clearProjectiles() {
        this.projectiles.forEach(p => this.scene.remove(p));
        this.projectiles = [];
    }
}
