import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import Stats from 'stats.js';
import { io } from 'socket.io-client';

// --- Configuration ---
const SCENE_COLOR = 0x87CEEB; // Sky blue
const GROUND_COLOR = 0x228B22; // Forest green
const BOX_COLOR = 0xff0000;
const MOVEMENT_SPEED = 10.0;
const JUMP_FORCE = 30.0;
const GRAVITY = 100.0; // Adjusted for mass-like feel

// --- Globals ---
let camera, scene, renderer, controls, stats;
let socket;
const objects = []; // Environment objects
const remotePlayers = {}; // { id: mesh }
let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const projectiles = [];
const PROJECTILE_SPEED = 50;

// UI
let health = 100;
const healthDisplay = document.createElement('div');
healthDisplay.style.position = 'absolute';
healthDisplay.style.bottom = '20px';
healthDisplay.style.left = '20px';
healthDisplay.style.color = '#ff0000';
healthDisplay.style.fontSize = '32px';
healthDisplay.style.fontWeight = 'bold';
healthDisplay.style.fontFamily = 'Arial, sans-serif';
healthDisplay.innerText = 'HEALTH: 100';
document.body.appendChild(healthDisplay);


init();

function init() {
    // 0. Stats
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_COLOR);
    scene.fog = new THREE.Fog(SCENE_COLOR, 0, 750);

    // 2. Light
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    // 3. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 2; // Eye level

    // 4. Controls
    controls = new PointerLockControls(camera, document.body);
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        instructions.style.opacity = 0;
    });

    controls.addEventListener('unlock', () => {
        instructions.style.display = '';
        instructions.style.opacity = 1;
    });

    scene.add(camera);

    // 5. Input Listeners
    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += JUMP_FORCE;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    const onMouseDown = function (event) {
        if (controls.isLocked) {
            shoot();
        }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);


    // 6. Raycast (for collision detection)
    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2);

    // 7. World Objects
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    const floorMaterial = new THREE.MeshBasicMaterial({ color: GROUND_COLOR, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    // Random Boxes
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
    for (let i = 0; i < 50; i++) {
        const boxMaterial = new THREE.MeshPhongMaterial({ flatShading: true, map: null });
        boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75);

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
        box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
        box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

        scene.add(box);
        objects.push(box);
    }

    // 8. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    // 9. Resize Handler
    window.addEventListener('resize', onWindowResize);

    // 10. Networking
    initNetworking();
}

function initNetworking() {
    // In Dev: Connect to localhost:3000
    // In Prod: Connect to relative path (same origin)
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/';
    socket = io(socketUrl); // Connect to server

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
    });

    // Load existing players
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) {
                addRemotePlayer(players[id]);
            }
        });
    });

    // New player joined
    socket.on('newPlayer', (playerInfo) => {
        addRemotePlayer(playerInfo);
    });

    // Player moved
    socket.on('playerMoved', (playerInfo) => {
        if (remotePlayers[playerInfo.id]) {
            remotePlayers[playerInfo.id].position.set(playerInfo.x, playerInfo.y, playerInfo.z);
            remotePlayers[playerInfo.id].rotation.y = playerInfo.rotation;
        }
    });

    // Player disconnected
    socket.on('playerDisconnected', (id) => {
        if (remotePlayers[id]) {
            scene.remove(remotePlayers[id]);
            delete remotePlayers[id];
        }
    });

    // Visual Shoot Event
    socket.on('playerShot', (data) => {
        if (remotePlayers[data.id]) {
            visualizeShot(remotePlayers[data.id].position, remotePlayers[data.id].rotation);
        }
    });

    // Health / Damage
    socket.on('playerDamaged', (data) => {
        if (data.id === socket.id) {
            health = data.health;
            healthDisplay.innerText = `HEALTH: ${health}`;

            // Flash red
            document.body.style.backgroundColor = 'red';
            setTimeout(() => { document.body.style.backgroundColor = ''; }, 100);
        }
    });

    socket.on('playerRespawn', (data) => {
        if (data.id === socket.id) {
            health = 100;
            healthDisplay.innerText = `HEALTH: ${health}`;
            camera.position.set(data.x, 2, data.z);
        }
    });
}

function addRemotePlayer(playerInfo) {
    const geometry = new THREE.BoxGeometry(2, 4, 2); // Simple humanoid box
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue players
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    mesh.rotation.y = playerInfo.rotation;

    scene.add(mesh);
    remotePlayers[playerInfo.id] = mesh;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function shoot() {
    // 1. Local Visuals
    visualizeShot(camera.position, camera.quaternion, true);

    // 2. Network Event
    socket.emit('shoot');

    // 3. Hit Detection (Client-side authoritative for simplicity)
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); // Center of screen

    // Check intersection with remote players
    const intersects = raycaster.intersectObjects(Object.values(remotePlayers));

    if (intersects.length > 0) {
        // Find the player ID belonging to the hit mesh
        const hitMesh = intersects[0].object;
        const hitId = Object.keys(remotePlayers).find(id => remotePlayers[id] === hitMesh);

        if (hitId) {
            console.log("Hit player:", hitId);
            socket.emit('playerHit', hitId);
        }
    }
}

function visualizeShot(origin, rotationOrQuaternion, isLocal = false) {
    const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    projectile.position.copy(origin);

    const direction = new THREE.Vector3(0, 0, -1);
    if (rotationOrQuaternion.isQuaternion) {
        direction.applyQuaternion(rotationOrQuaternion);
    } else {
        // Remote players send Euler y rotation, we need to reconstruct direction
        // This is a simplification; ideally we sync quaternion or look vector
        // For box players, rotation.y is usually enough for body, but not pitch.
        // We'll just shoot 'forward' from their body for now.
        direction.set(Math.sin(rotationOrQuaternion._y), 0, Math.cos(rotationOrQuaternion._y)); // Approximate
    }

    // Offset
    if (!isLocal) {
        // Re-calculate direction based on object rotation for remote players
        direction.set(0, 0, -1);
        direction.applyEuler(rotationOrQuaternion);
    } else {
        const d = new THREE.Vector3();
        controls.getDirection(d);
        direction.copy(d);
    }

    projectile.position.addScaledVector(direction, 2);

    projectile.userData = { velocity: direction.multiplyScalar(PROJECTILE_SPEED) };
    scene.add(projectile);
    projectiles.push(projectile);
}

function animate() {
    stats.begin();

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true) {

        // --- Physics / Movement ---
        raycaster.ray.origin.copy(camera.position);
        raycaster.ray.origin.y -= 2;

        // 1. Friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // 2. Gravity
        velocity.y -= GRAVITY * delta;

        // 3. Input
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        // 4. Move
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += (velocity.y * delta);

        // 5. Floor Collision
        if (camera.position.y < 2) {
            velocity.y = 0;
            camera.position.y = 2;
            canJump = true;
        }

        // --- Networking: Send Updates ---
        // Throttling could be added here, but sending every frame for 1-2 players is fine locally
        if (socket && socket.connected) {
            socket.emit('playerMovement', {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                rotation: camera.rotation.y // Only yaw is needed for body rotation usually
            });
        }
    }

    // --- Projectiles ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.position.addScaledVector(p.userData.velocity, delta);

        if (p.position.length() > 200) {
            scene.remove(p);
            projectiles.splice(i, 1);
        }
    }

    prevTime = time;

    renderer.render(scene, camera);
    stats.end();
}
