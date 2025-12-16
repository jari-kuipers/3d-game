import * as THREE from 'three'; // Implicit dependency? Better to inject or make peerDependency. 
// For now, let's keep it pure math/logic if possible or assume three is available if needed.
// Actually, using Vector3 is very convenient. I'll stick to math helper functions to avoid hard Three.js dependency if I can, OR add three as dependency.
// Adding three as dependency is safer for types and usage.

export class PhysicsEngine {
    constructor() {
        this.gravity = 9.8;
        this.playerSpeed = 10.0;
        this.jumpForce = 350.0; // Needs to match previous feel
        this.playerHeight = 2.0;
    }

    // Resolve collision with a cylindrical object (tree)
    resolveCylinderCollision(position, objectPos, playerRadius, objectRadius) {
        const dx = position.x - objectPos.x;
        const dz = position.z - objectPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = playerRadius + objectRadius;

        if (dist < minDist) {
            const angle = Math.atan2(dz, dx);
            const pushX = Math.cos(angle) * minDist;
            const pushZ = Math.sin(angle) * minDist;

            return {
                x: objectPos.x + pushX,
                z: objectPos.z + pushZ
            };
        }
        return null; // No collision
    }

    // Get smoothed height for camera/player
    getTerrainHeightAt(x, z, terrainMap) {
        // terrainMap should be an object with getHeight(x, z)
        return terrainMap.getHeight(x, z);
    }
}
