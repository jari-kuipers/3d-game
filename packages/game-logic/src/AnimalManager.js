import { TERRAIN_SIZE, WORLD_SIZE, ANIMAL_COUNT } from './Constants.js';

export class AnimalManager {
    constructor(terrainMap) {
        this.animals = {};
        this.terrainMap = terrainMap; // Should be an instance of TerrainMap or compatible
    }

    generateAnimals() {
        for (let i = 0; i < ANIMAL_COUNT; i++) {
            let x, z, y;
            let valid = false;
            // Retry until not underwater
            while (!valid) {
                x = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
                z = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
                y = this.terrainMap.getHeight(x, z);

                if (y > -8) valid = true; // Avoid deep water
            }

            const id = `animal_${i}`;
            this.animals[id] = {
                id,
                x, y, z,
                spawnX: x,
                spawnZ: z,
                targetX: x,
                targetZ: z,
                rotation: Math.random() * Math.PI * 2,
                state: 'idle',
                waitTimer: 0
            };
        }
        console.log(`Generated ${ANIMAL_COUNT} animals.`);
        return this.animals;
    }

    update(deltaTime = 0.1) {
        for (const id in this.animals) {
            const animal = this.animals[id];

            if (animal.state === 'idle') {
                animal.waitTimer -= deltaTime;
                if (animal.waitTimer <= 0) {
                    // Pick new target
                    const range = 20;
                    const rX = animal.spawnX + (Math.random() * range * 2 - range);
                    const rZ = animal.spawnZ + (Math.random() * range * 2 - range);

                    animal.targetX = rX;
                    animal.targetZ = rZ;
                    animal.state = 'moving';
                }
            } else if (animal.state === 'moving') {
                const speed = 3.0 * deltaTime; // 3 units per second
                const dx = animal.targetX - animal.x;
                const dz = animal.targetZ - animal.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < speed) {
                    animal.x = animal.targetX;
                    animal.z = animal.targetZ;
                    animal.state = 'idle';
                    animal.waitTimer = 2 + Math.random() * 3;
                } else {
                    const angle = Math.atan2(dx, dz);
                    animal.x += Math.sin(angle) * speed;
                    animal.z += Math.cos(angle) * speed;
                    animal.rotation = angle;
                }

                // Update Y
                animal.y = this.terrainMap.getHeight(animal.x, animal.z);
            }
        }
        return this.animals;
    }
}
