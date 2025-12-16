import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { TerrainGenerator, TerrainMap } from 'terrain-gen';
import { AnimalManager, TERRAIN_SIZE, WORLD_SIZE } from 'game-logic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

const players = {};
let playerCount = 0;
const trees = [];

// Initialize Terrain
const terrainGen = new TerrainGenerator();
const terrainData = terrainGen.generate(TERRAIN_SIZE);
const terrainMap = new TerrainMap(terrainData, TERRAIN_SIZE, WORLD_SIZE);

// Initialize Animals
const animalManager = new AnimalManager(terrainMap);
const animals = animalManager.generateAnimals(); // Returns internal animal object

// Generate Trees
function generateTrees() {
    const TREE_COUNT = 200;
    for (let i = 0; i < TREE_COUNT; i++) {
        const x = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
        const z = (Math.random() * WORLD_SIZE) - (WORLD_SIZE / 2);
        const y = terrainMap.getHeight(x, z);

        if (y > -10) {
            trees.push({ x, y, z });
        }
    }
    console.log(`Generated ${trees.length} trees.`);
}
generateTrees();

// Game Loop
setInterval(() => {
    animalManager.update(0.1);

    // Broadcast animal updates? 
    // Optimization: Check which animals moved (state === 'moving') or just broadcast all for now as before.
    // Ideally we should have a 'getDirty' method or similar.
    // For now, let's just emit 'animalMoved' for every moving animal to match previous behavior

    Object.values(animals).forEach(animal => {
        if (animal.state === 'moving') {
            io.emit('animalMoved', {
                id: animal.id,
                x: animal.x,
                y: animal.y,
                z: animal.z,
                rotation: animal.rotation
            });
        }
    });

}, 100);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 40 - 20,
        y: 2,
        z: Math.random() * 40 - 20,
        rotation: 0,
        rx: 0,
        health: 100,
        name: `Player ${++playerCount}`
    };

    socket.emit('currentPlayers', players);

    socket.emit('levelConfig', {
        size: TERRAIN_SIZE,
        worldSize: WORLD_SIZE,
        heightMap: terrainData
    });

    socket.emit('treeConfig', trees);
    socket.emit('currentAnimals', animals);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            players[socket.id].rx = movementData.rx;

            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('shoot', () => {
        // Shooting disabled in survival
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
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
