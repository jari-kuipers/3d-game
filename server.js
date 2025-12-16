const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { createNoise2D } = require('simplex-noise');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow Vite dev server and production
        methods: ["GET", "POST"]
    }
});

// Serve static files from 'dist' (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

const players = {};
let playerCount = 0;
// const levelObjects = []; // DEPRECATED: Old box output
const TERRAIN_SIZE = 100; // 100x100 grid
const WORLD_SIZE = 2000;
const SEGMENT_SIZE = WORLD_SIZE / TERRAIN_SIZE;
let terrainData = []; // 2D array of heights
const trees = []; // Array of {x, y, z}
const animals = {}; // Key: ID, Value: { id, x, y, z, spawnX, spawnZ, targetX, targetZ }

// Generate Terrain (Perlin Noise)
function generateTerrain() {
    const noise2D = createNoise2D();
    const frequency = 0.05;
    const amplitude = 60; // Max height variation

    for (let x = 0; x <= TERRAIN_SIZE; x++) {
        const row = [];
        for (let z = 0; z <= TERRAIN_SIZE; z++) {
            // Noise returns -1 to 1. Map to 0 to amplitude roughly.
            // Using x, z as coordinates
            const val = noise2D(x * frequency, z * frequency);
            const height = val * amplitude;
            row.push(height);
        }
        terrainData.push(row);
    }
    console.log(`Generated terrain: ${TERRAIN_SIZE}x${TERRAIN_SIZE}`);
}

function generateTrees() {
    const TREE_COUNT = 200;

    for (let i = 0; i < TREE_COUNT; i++) {
        // Random Position
        const x = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
        const z = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);

        // Map world x,z to grid coordinates
        // Note: This logic duplicates what's on the client 'getTerrainHeight' but simpler for grid lookup
        // We can just grab the nearest grid point for simplicity or implement bilinear here too.
        // Nearest neighbor is fine for placement.

        // Find Height with Bilinear Interpolation for smooth placement
        const halfSize = WORLD_SIZE / 2;
        const segmentSize = WORLD_SIZE / TERRAIN_SIZE; // 20

        // Continuous grid coordinates
        let gridX = (x + halfSize) / segmentSize;
        let gridZ = (z + halfSize) / segmentSize;

        // Clamp
        if (gridX < 0) gridX = 0;
        if (gridX >= TERRAIN_SIZE) gridX = TERRAIN_SIZE - 0.001;
        if (gridZ < 0) gridZ = 0;
        if (gridZ >= TERRAIN_SIZE) gridZ = TERRAIN_SIZE - 0.001;

        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = Math.min(x0 + 1, TERRAIN_SIZE);
        const z1 = Math.min(z0 + 1, TERRAIN_SIZE);

        const tx = gridX - x0;
        const tz = gridZ - z0;

        // Lookup heights
        const h00 = terrainData[x0][z0];
        const h10 = terrainData[x1][z0];
        const h01 = terrainData[x0][z1];
        const h11 = terrainData[x1][z1];

        // Interpolate
        const h0 = h00 * (1 - tx) + h10 * tx;
        const h1 = h01 * (1 - tx) + h11 * tx;
        const y = h0 * (1 - tz) + h1 * tz;

        // Filter: Don't place underwater
        if (y > -10) {
            trees.push({ x, y, z });
        }
    }
    console.log(`Generated ${trees.length} trees.`);
}

function getTerrainHeight(x, z) {
    const halfSize = WORLD_SIZE / 2;
    const segmentSize = WORLD_SIZE / TERRAIN_SIZE;

    // Grid coordinates
    let gridX = (x + halfSize) / segmentSize;
    let gridZ = (z + halfSize) / segmentSize;

    // Clamp
    if (gridX < 0) gridX = 0;
    if (gridX >= TERRAIN_SIZE) gridX = TERRAIN_SIZE - 0.001;
    if (gridZ < 0) gridZ = 0;
    if (gridZ >= TERRAIN_SIZE) gridZ = TERRAIN_SIZE - 0.001;

    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, TERRAIN_SIZE);
    const z1 = Math.min(z0 + 1, TERRAIN_SIZE);

    const tx = gridX - x0;
    const tz = gridZ - z0;

    const h00 = terrainData[x0][z0];
    const h10 = terrainData[x1][z0];
    const h01 = terrainData[x0][z1];
    const h11 = terrainData[x1][z1];

    // Bilinear Interpolation
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;

    return h0 * (1 - tz) + h1 * tz;
}

function generateAnimals() {
    const ANIMAL_COUNT = 50;
    for (let i = 0; i < ANIMAL_COUNT; i++) {
        const id = `animal_${i}`;
        const x = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
        const z = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);

        const y = getTerrainHeight(x, z);

        // Avoid water
        if (y > -5) {
            animals[id] = {
                id,
                x, y, z,
                spawnX: x,
                spawnZ: z,
                targetX: x,
                targetZ: z,
                rotation: 0,
                state: 'idle', // idle, moving
                waitTimer: 0
            };
        }
    }
    console.log(`Generated ${Object.keys(animals).length} animals.`);
}

function updateAnimals() {
    const speed = 5.0; // Units per second
    const delta = 0.1; // 100ms tick
    const wanderRadius = 50;

    Object.values(animals).forEach(animal => {
        if (animal.state === 'idle') {
            animal.waitTimer -= delta;
            if (animal.waitTimer <= 0) {
                // Pick new target
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * wanderRadius;
                animal.targetX = animal.spawnX + Math.cos(angle) * dist;
                animal.targetZ = animal.spawnZ + Math.sin(angle) * dist;
                animal.state = 'moving';
            }
        } else if (animal.state === 'moving') {
            const dx = animal.targetX - animal.x;
            const dz = animal.targetZ - animal.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 1.0) {
                animal.state = 'idle';
                animal.waitTimer = 2.0 + Math.random() * 3.0; // Wait 2-5s
            } else {
                const moveDist = speed * delta;
                const ratio = Math.min(moveDist, dist) / dist;
                animal.x += dx * ratio;
                animal.z += dz * ratio;

                // Update Y
                animal.y = getTerrainHeight(animal.x, animal.z);

                // Rotation

                // Rotation
                animal.rotation = Math.atan2(dx, dz);

                // Broadcast movement (throttled or every tick?)
                // For 50 animals every 100ms might be heavy if all moving. 
                // Let's send in batch outside or just emit here for simplicity now.
                io.emit('animalMoved', {
                    id: animal.id,
                    x: animal.x,
                    y: animal.y,
                    z: animal.z,
                    rotation: animal.rotation
                });
            }
        }
    });
}

generateTerrain();
generateTrees();
generateAnimals();

setInterval(updateAnimals, 100);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initial State
    // Assign a random start position but on the floor
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 40 - 20, // Small centralized spawn area
        y: 2,
        z: Math.random() * 40 - 20,
        rotation: 0,
        rx: 0, // Rotation X (Pitch)
        health: 100,
        kills: 0,
        deaths: 0,
        name: `Player ${++playerCount}`
    };

    // Send current players to new player
    socket.emit('currentPlayers', players);

    socket.emit('levelConfig', {
        size: TERRAIN_SIZE,
        worldSize: WORLD_SIZE,
        heightMap: terrainData
    });

    // Send tree configuration
    socket.emit('treeConfig', trees);

    // Send animals
    socket.emit('currentAnimals', animals);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            players[socket.id].rx = movementData.rx;

            // Broadcast movement to others
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('shoot', () => {
        // Just broadcast visual effect source for now
        socket.broadcast.emit('playerShot', { id: socket.id });
    });

    socket.on('playerHit', (targetId) => {
        if (players[targetId]) {
            players[targetId].health -= 10;
            io.emit('playerDamaged', { id: targetId, health: players[targetId].health });

            if (players[targetId].health <= 0) {
                // Respawn Logic
                players[targetId].health = 100;
                players[targetId].deaths++;
                players[targetId].x = Math.random() * 40 - 20;
                players[targetId].z = Math.random() * 40 - 20;

                // Credit Killer
                if (players[socket.id]) {
                    players[socket.id].kills++;
                }

                // Kill Feed Message
                const victimName = players[targetId].name;
                const killerName = players[socket.id] ? players[socket.id].name : "Unknown";
                io.emit('chatMessage', { id: 'System', message: `${victimName} 🔫 ${killerName}` });

                // Leaderboard Update
                io.emit('leaderboardUpdate', Object.values(players));

                io.emit('playerRespawn', players[targetId]);
            }
        }
    });

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, message: msg });
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
