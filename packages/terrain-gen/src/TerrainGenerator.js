import { createNoise2D } from 'simplex-noise';

export class TerrainGenerator {
    constructor(seed = 'seed') {
        this.noise2D = createNoise2D(); // Seed unused in simplex-noise 4.x basic usage but consistent instance
        this.terrainSize = 100;
        this.amplitude = 60;
        this.frequency = 0.05;
    }

    generate(size = 100) {
        this.terrainSize = size;
        const terrainData = [];
        for (let x = 0; x <= this.terrainSize; x++) {
            const row = [];
            for (let z = 0; z <= this.terrainSize; z++) {
                const val = this.noise2D(x * this.frequency, z * this.frequency);
                const height = val * this.amplitude;
                row.push(height);
            }
            terrainData.push(row);
        }
        return terrainData;
    }
}
