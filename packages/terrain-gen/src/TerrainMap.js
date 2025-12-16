export class TerrainMap {
    constructor(data, size, worldSize) {
        this.data = data;
        this.size = size;
        this.worldSize = worldSize;
    }

    getHeight(x, z) {
        const halfSize = this.worldSize / 2;
        const segmentSize = this.worldSize / this.size;

        let gridX = (x + halfSize) / segmentSize;
        let gridZ = (z + halfSize) / segmentSize;

        if (gridX < 0) gridX = 0;
        if (gridX >= this.size) gridX = this.size - 0.001;
        if (gridZ < 0) gridZ = 0;
        if (gridZ >= this.size) gridZ = this.size - 0.001;

        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = Math.min(x0 + 1, this.size);
        const z1 = Math.min(z0 + 1, this.size);

        const tx = gridX - x0;
        const tz = gridZ - z0;

        const h00 = this.data[x0][z0];
        const h10 = this.data[x1][z0];
        const h01 = this.data[x0][z1];
        const h11 = this.data[x1][z1];

        const h0 = h00 * (1 - tx) + h10 * tx;
        const h1 = h01 * (1 - tx) + h11 * tx;

        return h0 * (1 - tz) + h1 * tz;
    }
}
