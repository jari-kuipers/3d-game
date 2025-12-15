const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

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
const CANVAS_SIZE = 2000; // Match floor size for limits

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
