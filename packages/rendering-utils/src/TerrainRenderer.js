import * as THREE from 'three';

const GROUND_COLOR = 0x228B22;

/**
 * Terrain rendering utilities
 */
export class TerrainRenderer {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.terrainData = null;
    }

    /**
     * Load and render terrain from level data
     */
    loadTerrain(levelData) {
        this.terrainData = levelData;
        const { size, worldSize, heightMap } = levelData;

        // Create plane geometry
        const geometry = new THREE.PlaneGeometry(worldSize, worldSize, size, size);
        geometry.rotateX(-Math.PI / 2);

        // Apply height map to vertices
        const positions = geometry.attributes.position.array;
        for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
            const ix = j % (size + 1);
            const iz = Math.floor(j / (size + 1));

            if (iz <= size && ix <= size) {
                const h = heightMap[ix][iz];
                positions[i + 1] = h; // Set Y height
            }
        }

        geometry.computeVertexNormals();

        // Create material and mesh
        const material = new THREE.MeshStandardMaterial({
            color: GROUND_COLOR,
            flatShading: true,
            side: THREE.DoubleSide
        });

        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
        }

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.terrainMesh);

        console.log("Terrain loaded!");
    }

    /**
     * Get terrain height at world position (x, z) using bilinear interpolation
     */
    getHeight(x, z) {
        if (!this.terrainData) return 0;

        const { size, worldSize, heightMap } = this.terrainData;
        const halfWorld = worldSize / 2;

        // Convert world coordinates to grid coordinates
        const gridX = ((x + halfWorld) / worldSize) * size;
        const gridZ = ((z + halfWorld) / worldSize) * size;

        // Clamp to grid bounds
        const clampedX = Math.max(0, Math.min(size, gridX));
        const clampedZ = Math.max(0, Math.min(size, gridZ));

        // Get surrounding grid points
        const x0 = Math.floor(clampedX);
        const z0 = Math.floor(clampedZ);
        const x1 = Math.min(x0 + 1, size);
        const z1 = Math.min(z0 + 1, size);

        // Fractional parts
        const tx = clampedX - x0;
        const tz = clampedZ - z0;

        // Heights at corners
        const h00 = heightMap[x0][z0];
        const h10 = heightMap[x1][z0];
        const h01 = heightMap[x0][z1];
        const h11 = heightMap[x1][z1];

        // Bilinear interpolation
        const h0 = h00 * (1 - tx) + h10 * tx;
        const h1 = h01 * (1 - tx) + h11 * tx;

        return h0 * (1 - tz) + h1 * tz;
    }

    /**
     * Get terrain normal at position (x, z) for slope calculations
     */
    getNormal(x, z) {
        if (!this.terrainData) return new THREE.Vector3(0, 1, 0);

        const EPSILON = 0.5;
        const hL = this.getHeight(x - EPSILON, z);
        const hR = this.getHeight(x + EPSILON, z);
        const hD = this.getHeight(x, z + EPSILON);
        const hU = this.getHeight(x, z - EPSILON);

        // Calculate normal from height differences
        const v1 = new THREE.Vector3(2 * EPSILON, hR - hL, 0);
        const v2 = new THREE.Vector3(0, hD - hU, 2 * EPSILON);

        const normal = new THREE.Vector3();
        normal.crossVectors(v2, v1).normalize();

        return normal;
    }
}
