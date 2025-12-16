import * as THREE from 'three';
import Stats from 'stats.js';
import { GameEngine, InputManager, PhysicsController, NetworkClient } from 'client-core';
import { TerrainRenderer, EntityRenderer } from 'rendering-utils';
import { UIComponents } from 'ui-components';
import { AnimalManager } from 'animal-animation';

// --- Game State ---
const remotePlayers = {};
let health = 100;

// --- Initialize Core Systems ---
const engine = new GameEngine();
const input = new InputManager();
const network = new NetworkClient();
const terrain = new TerrainRenderer(engine.scene);
const physics = new PhysicsController(engine.camera, engine.controls, {
    spawnPosition: { x: 180, y: 2, z: 0 }
});
const animalManager = new AnimalManager(engine.scene, terrain, EntityRenderer);

// --- UI Setup ---
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const healthDisplay = UIComponents.createHealthDisplay();

// --- Setup Controls ---
const instructions = document.getElementById('instructions');
engine.setupPointerLock(instructions);

// --- Networking Setup ---
network.on('levelConfig', (levelData) => {
    terrain.loadTerrain(levelData);
    physics.setTerrain(terrain);
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
});

network.on('playerMoved', (playerInfo) => {
    if (remotePlayers[playerInfo.id]) {
        remotePlayers[playerInfo.id].position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        remotePlayers[playerInfo.id].rotation.y = playerInfo.rotation;
    }
});

network.on('playerDisconnected', (id) => {
    if (remotePlayers[id]) {
        engine.scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
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

    // Update animals (position/rotation interpolation, terrain alignment)
    animalManager.update(delta);

    stats.end();
});

// --- Start the game ---
engine.start();
