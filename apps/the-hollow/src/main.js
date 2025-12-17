import { DungeonRenderer } from './DungeonRenderer.js';
import * as THREE from 'three';
import Stats from 'stats.js';
import { GameEngine, InputManager, PhysicsController, NetworkClient } from 'client-core';
import { TerrainRenderer, EntityRenderer } from 'rendering-utils';
import { UIComponents } from 'ui-components';
import { WeaponSystem } from 'shooting-mechanics';
import { AnimalManager } from 'animal-animation';

// --- Game State ---
const remotePlayers = {};
let health = 100;

// --- Initialize Core Systems ---
const engine = new GameEngine();
const input = new InputManager();
const network = new NetworkClient();
const dungeonRenderer = new DungeonRenderer(engine.scene);
const physics = new PhysicsController(engine.camera, engine.controls, {
    spawnPosition: { x: 0, y: 0, z: 0 } // Start at 0,0,0 (first room)
});
const weapons = new WeaponSystem(engine.scene, engine.camera);

// --- UI Setup ---
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const healthDisplay = UIComponents.createHealthDisplay();
const chatContainer = UIComponents.createChatContainer();
const leaderboard = UIComponents.createLeaderboard();

// --- Setup Controls ---
const instructions = document.getElementById('instructions');
engine.setupPointerLock(instructions);

// --- Chat Input Setup ---
const chatInput = document.getElementById('chat-input');
if (chatInput) {
    UIComponents.setupChatInput(chatInput, engine.controls, network);
}

// --- Leaderboard Toggle ---
UIComponents.setupLeaderboardToggle(leaderboard);

// --- Shooting ---
document.addEventListener('mousedown', () => {
    if (engine.controls.isLocked) {
        weapons.shoot(engine.controls, remotePlayers, network);
    }
});

// Mobile shoot button
const btnShoot = document.getElementById('btn-shoot');
if (btnShoot) {
    btnShoot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        weapons.shoot(engine.controls, remotePlayers, network);
    });
}

// Join Room
const roomCode = window.prompt("Enter Room Code", "default");
network.joinRoom(roomCode || "default");
// ...
const animals = {}; // Dummy for now
const animalManager = { update: () => { }, handleInitialAnimals: () => { }, handleAnimalUpdate: () => { }, getAnimals: () => [] }; // Dummy

// ...

network.on('levelConfig', (levelData) => {
    // levelData is dungeonData now
    dungeonRenderer.loadDungeon(levelData.heightMap || levelData);

    physics.setTerrain(dungeonRenderer);
});

network.on('treeConfig', (trees) => {
    EntityRenderer.loadTrees(engine.scene, trees, physics.collidables);
});

network.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== network.id) {
            addRemotePlayer(players[id]);
        }
    });
});

network.on('newPlayer', (playerInfo) => {
    addRemotePlayer(playerInfo);
    UIComponents.addChatMessage(chatContainer, 'Player joined', '#00FF00');
});

network.on('playerMoved', (playerInfo) => {
    if (remotePlayers[playerInfo.id]) {
        remotePlayers[playerInfo.id].position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        remotePlayers[playerInfo.id].rotation.y = playerInfo.rotation;
        remotePlayers[playerInfo.id].userData.rx = playerInfo.rx;
    }
});

network.on('playerDisconnected', (id) => {
    if (remotePlayers[id]) {
        engine.scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
        UIComponents.addChatMessage(chatContainer, 'Player left', '#FF0000');
    }
});

network.on('playerShot', (data) => {
    if (remotePlayers[data.id]) {
        const p = remotePlayers[data.id];
        weapons.visualizeShot(p.position, { _y: p.rotation.y, _x: p.userData.rx || 0 });
    }
});

network.on('playerDamaged', (data) => {
    if (data.id === network.id) {
        health = data.health;
        healthDisplay.innerText = `HEALTH: ${health}`;

        // Flash red
        document.body.style.backgroundColor = 'red';
        setTimeout(() => { document.body.style.backgroundColor = ''; }, 100);
    }
});

network.on('playerRespawn', (data) => {
    if (data.id === network.id) {
        health = 100;
        healthDisplay.innerText = `HEALTH: ${health}`;
        engine.camera.position.set(data.x, 2, data.z);
    }
});

network.on('chatMessage', (data) => {
    const sender = data.id === 'System' ? '' : `[${data.id.substring(0, 5)}] `;
    const color = data.id === 'System' ? '#FFFF00' : '#FFFFFF';
    UIComponents.addChatMessage(chatContainer, `${sender}${data.message}`, color);
});

network.on('leaderboardUpdate', (playersList) => {
    UIComponents.updateLeaderboard(playersList);
});

network.on('currentAnimals', (animals) => {
    animalManager.handleInitialAnimals(animals);
});

network.on('animalMoved', (data) => {
    animalManager.handleAnimalUpdate(data);
});

// --- Helper Functions ---
function addRemotePlayer(playerInfo) {
    const mesh = EntityRenderer.createPlayerMesh();
    mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    mesh.rotation.y = playerInfo.rotation;
    mesh.userData.rx = playerInfo.rx || 0;

    if (playerInfo.name) {
        const nameTag = EntityRenderer.createNameTag(playerInfo.name);
        nameTag.position.y = 2.5;
        mesh.add(nameTag);
    }

    engine.scene.add(mesh);
    remotePlayers[playerInfo.id] = mesh;
}

// --- Animation Loop ---
engine.onAnimate((delta, time) => {
    stats.begin();

    if (engine.controls.isLocked || input.isTouchDevice) {
        // Get input direction
        const inputDirection = input.getInputDirection();

        // Set dynamic collidables (sheep)
        physics.setDynamicCollidables(animalManager.getAnimals(), 1.5);

        // Update physics
        physics.update(delta, inputDirection, input);

        // Send network updates
        network.sendMovement(engine.camera.position, engine.camera.rotation);
    }

    // Update weapons (projectiles)
    weapons.update(delta);

    // Update animals (position/rotation interpolation, terrain alignment)
    animalManager.update(delta);

    stats.end();
});

// --- Start the game ---
engine.start();
