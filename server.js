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
// const levelObjects = []; // DEPRECATED: Old box output
const TERRAIN_SIZE = 100; // 100x100 grid
const WORLD_SIZE = 2000;
const SEGMENT_SIZE = WORLD_SIZE / TERRAIN_SIZE;
let terrainData = []; // 2D array of heights

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

generateTerrain();

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
        health: 100
    };

    // Send current players to new player
    socket.emit('currentPlayers', players);

    // Send level configuration
    socket.emit('levelConfig', {
        size: TERRAIN_SIZE,
        worldSize: WORLD_SIZE,
        heightMap: terrainData
    });

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;

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
                players[targetId].x = Math.random() * 40 - 20;
                players[targetId].z = Math.random() * 40 - 20;

                io.emit('playerRespawn', players[targetId]);
            }
        }
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
