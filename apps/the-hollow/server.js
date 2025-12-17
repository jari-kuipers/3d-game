import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { DungeonGenerator } from 'dungeon-gen';
import { AnimalManager, WORLD_SIZE } from 'game-logic';

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

// Room State
const rooms = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    let currentRoom = null;

    socket.on('joinRoom', (roomCode) => {
        // Leave previous room if any
        if (currentRoom) {
            socket.leave(currentRoom);
            // Handle disconnect logic for previous room?
        }

        socket.join(roomCode);
        currentRoom = roomCode;

        // Initialize room if not exists
        if (!rooms[roomCode]) {
            console.log(`Creating new room: ${roomCode}`);
            const dungeonGen = new DungeonGenerator();
            rooms[roomCode] = {
                players: {},
                playerCount: 0,
                dungeon: dungeonGen.generate(WORLD_SIZE),
                animals: {}, // Future use
                trees: [] // No trees in dungeon
            };
        }

        const room = rooms[roomCode];

        // Add player to room
        room.players[socket.id] = {
            id: socket.id,
            x: 0, // Start at 0,0,0
            y: 2,
            z: 0,
            rotation: 0,
            rx: 0,
            health: 100,
            kills: 0,
            deaths: 0,
            name: `Player ${++room.playerCount}`
        };

        // Send initial state
        socket.emit('currentPlayers', room.players);
        socket.emit('levelConfig', room.dungeon);
        // socket.emit('treeConfig', room.trees);
        // socket.emit('currentAnimals', room.animals);
        socket.emit('leaderboardUpdate', Object.values(room.players));

        // Notify others in room
        socket.to(roomCode).emit('newPlayer', room.players[socket.id]);

        socket.emit('chatMessage', { id: 'System', message: `Joined room ${roomCode}` });
    });

    socket.on('playerMovement', (movementData) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            const player = rooms[currentRoom].players[socket.id];
            player.x = movementData.x;
            player.y = movementData.y;
            player.z = movementData.z;
            player.rotation = movementData.rotation;
            player.rx = movementData.rx;

            socket.to(currentRoom).emit('playerMoved', player);
        }
    });

    socket.on('shoot', () => {
        if (currentRoom) {
            socket.to(currentRoom).emit('playerShot', { id: socket.id });
        }
    });

    socket.on('playerHit', (targetId) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[targetId]) {
            const room = rooms[currentRoom];
            const target = room.players[targetId];

            target.health -= 10;
            io.to(currentRoom).emit('playerDamaged', { id: targetId, health: target.health });

            if (target.health <= 0) {
                target.health = 100;
                target.deaths++;
                // Respawn at random start room pos? or 0,0,0
                target.x = 0;
                target.z = 0;

                if (room.players[socket.id]) {
                    room.players[socket.id].kills++;
                }

                const victimName = target.name;
                const killerName = room.players[socket.id] ? room.players[socket.id].name : "Unknown";
                io.to(currentRoom).emit('chatMessage', { id: 'System', message: `${victimName} 🔫 ${killerName}` });

                io.to(currentRoom).emit('leaderboardUpdate', Object.values(room.players));
                io.to(currentRoom).emit('playerRespawn', target);
            }
        }
    });

    socket.on('chatMessage', (msg) => {
        if (currentRoom) {
            io.to(currentRoom).emit('chatMessage', { id: socket.id, message: msg });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        if (currentRoom && rooms[currentRoom]) {
            if (rooms[currentRoom].players[socket.id]) {
                delete rooms[currentRoom].players[socket.id];
                io.to(currentRoom).emit('playerDisconnected', socket.id);
            }

            // Clean up empty room?
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
                console.log(`Room ${currentRoom} deleted empty`);
            }
        }
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
