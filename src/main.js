import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import Stats from 'stats.js';
import { io } from 'socket.io-client';
import nipplejs from 'nipplejs';

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
const objects = []; // Environment objects (Deprecated?)
const remotePlayers = {}; // { id: mesh }
const remoteAnimals = {}; // { id: mesh }
let raycaster;
let terrainMesh;
let terrainData = null; // { size, worldSize, heightMap }

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let isTouchDevice = false;

// Mobile Input State
const joystickLookVector = new THREE.Vector2(0, 0);
const joystickMoveVector = new THREE.Vector2(0, 0);

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
    camera.rotation.order = 'YXZ'; // Prevents roll/gimbal lock
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
        // Chat Toggle
        if (event.code === 'Enter') {
            const chatInput = document.getElementById('chat-input');
            if (chatInput.style.display === 'none') {
                // Open Chat
                controls.unlock();
                chatInput.style.display = 'block';
                chatInput.focus();
                // prevent movement
                moveForward = false; moveBackward = false; moveLeft = false; moveRight = false;
            } else {
                // Send / Close Chat
                const msg = chatInput.value;
                if (msg.trim() !== '') {
                    socket.emit('chatMessage', msg);
                    chatInput.value = '';
                }
                chatInput.style.display = 'none';
                controls.lock();
            }
            return;
        }

        // Block movement if chat is open
        if (document.getElementById('chat-input').style.display !== 'none') return;

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
    // scene.add(floor); // REPLACED BY TERRAIN


    // Random Boxes - MOVED TO SERVER
    // Waiting for 'levelConfig' event...

    // 8. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    // Check for touch
    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // 9. Resize Handler
    window.addEventListener('resize', onWindowResize);

    // 10. Networking
    initNetworking();

    // 11. Mobile Controls
    initMobileControls();
}

function initMobileControls() {
    if (isTouchDevice) {
        const instructions = document.getElementById('instructions');
        if (instructions) instructions.style.display = 'none';
    }

    // Left Joystick (Movement)
    const zoneLeft = document.getElementById('zone_joystick_left');
    const managerLeft = nipplejs.create({
        zone: zoneLeft,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white'
    });

    managerLeft.on('move', (evt, data) => {
        joystickMoveVector.set(data.vector.x, data.vector.y);
    });

    managerLeft.on('end', () => {
        joystickMoveVector.set(0, 0);
    });

    // Right Joystick (Look)
    const zoneRight = document.getElementById('zone_joystick_right');
    const managerRight = nipplejs.create({
        zone: zoneRight,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white'
    });

    managerRight.on('move', (evt, data) => {
        joystickLookVector.set(data.vector.x, data.vector.y);
    });

    managerRight.on('end', () => {
        joystickLookVector.set(0, 0);
    });

    // Shoot Button
    const btnShoot = document.getElementById('btn-shoot');
    btnShoot.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent accidental selection
        shoot();
    });
}

function initNetworking() {
    // In Dev: Connect to current hostname:3000 (allows LAN access)
    // In Prod: Connect to relative path (same origin)
    const socketUrl = import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '/';
    socket = io(socketUrl); // Connect to server

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
    });

    // Level Config
    socket.on('levelConfig', (levelData) => {
        loadLevel(levelData);
    });

    // Tree Config
    socket.on('treeConfig', (trees) => {
        loadTrees(trees);
    });

    // Tree Config
    socket.on('treeConfig', (trees) => {
        loadTrees(trees);
    });

    // Animals
    socket.on('currentAnimals', (animals) => {
        Object.values(animals).forEach(animalData => {
            updateRemoteAnimal(animalData);
        });
    });

    socket.on('animalMoved', (animalData) => {
        updateRemoteAnimal(animalData);
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

    socket.on('chatMessage', (data) => {
        const chatMessages = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.textContent = `${data.id.substring(0, 5)}: ${data.message}`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto scroll
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

function loadLevel(levelData) {
    // Expecting { size, worldSize, heightMap }
    terrainData = levelData;

    const segments = levelData.size;
    const worldSize = levelData.worldSize;

    // Create Plane
    const geometry = new THREE.PlaneGeometry(worldSize, worldSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Modify Vertices based on HeightMap
    // Position attribute is Float32Array [x, y, z, x, y, z, ...]
    const positions = geometry.attributes.position.array;

    // The plane is now flat on XZ. "Y" is Up. 
    // Vertices are ordered row by row (Z) then col by col (X) usually.
    // Let's iterate carefully.

    for (let i = 0, j = 0, k = 0; i < positions.length; i += 3) {
        // positions[i] is x
        // positions[i+1] is y (up)
        // positions[i+2] is z

        // We want to map this vertex to our heightmap grid
        // The plane geometry is centered at 0,0 usually.
        // x goes from -1000 to 1000.
        // z goes from -1000 to 1000.

        // Grid coordinates (0 to 100)
        // We know the vertex order for PlaneGeometry is row-major?
        // Actually, let's just use the index `j` which counts vertices

        // row index = floor(j / (segments + 1))
        // col index = j % (segments + 1)

        const ix = j % (segments + 1);
        const iz = Math.floor(j / (segments + 1));

        if (iz <= segments && ix <= segments) {
            const h = levelData.heightMap[ix][iz]; // Map uses [x][z]
            positions[i + 1] = h; // Set Y height
        }

        j++;
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: GROUND_COLOR,
        flatShading: true,
        side: THREE.DoubleSide
    });

    if (terrainMesh) scene.remove(terrainMesh);
    terrainMesh = new THREE.Mesh(geometry, material);
    scene.add(terrainMesh);

    console.log("Terrain loaded!");
    console.log("Terrain loaded!");
}

function loadTrees(trees) {
    // 3x Size
    const trunkGeometry = new THREE.CylinderGeometry(1.5, 1.5, 15, 8); // 0.5->1.5, 5->15
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

    const leavesGeometry = new THREE.ConeGeometry(9, 24, 8); // 3->9, 8->24
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });

    trees.forEach(tree => {
        // Group for the tree
        const treeGroup = new THREE.Group();
        treeGroup.position.set(tree.x, tree.y, tree.z);

        // Trunk
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 7.5; // Half height (15 / 2)
        treeGroup.add(trunk);

        // Leaves
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 21; // Trunk height (15) + half leaves height (24/2 = 12) - overlap (6) -> ~21
        treeGroup.add(leaves);

        scene.add(treeGroup);
        // objects.push(trunk); // Optional: collide with trunks?
    });
    console.log(`Loaded ${trees.length} trees.`);
}

function updateRemoteAnimal(data) {
    let mesh = remoteAnimals[data.id];
    if (!mesh) {
        // Create new
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 3.0); // Longer Z to see rotation
        const material = new THREE.MeshStandardMaterial({ color: 0xFF5733 });
        mesh = new THREE.Mesh(geometry, material);

        // Add "eyes" or distinct front feature
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.5, 0.5, 1.5); // Local Z is forward? Check logic
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.5, 0.5, 1.5);
        mesh.add(leftEye);
        mesh.add(rightEye);

        scene.add(mesh);
        remoteAnimals[data.id] = mesh;

        // Init target props
        mesh.userData.targetPosition = new THREE.Vector3(data.x, data.y + 0.75, data.z);
        mesh.userData.targetRotation = data.rotation || 0;

        // Set initial pos instantly
        mesh.position.copy(mesh.userData.targetPosition);
        mesh.rotation.y = mesh.userData.targetRotation;
        return;
    }

    // Update target pos
    if (!mesh.userData.targetPosition) mesh.userData.targetPosition = new THREE.Vector3();
    mesh.userData.targetPosition.set(data.x, data.y + 0.75, data.z);

    // Update target rotation
    mesh.userData.targetRotation = data.rotation || 0;
}

function getTerrainHeight(x, z) {
    if (!terrainData) return 0;

    const { size, worldSize, heightMap } = terrainData;
    const segmentSize = worldSize / size; // 20
    const halfSize = worldSize / 2; // 1000

    // Convert world pos to grid pos (0 to 100)
    // x: -1000 -> 0, 1000 -> 100
    let gridX = (x + halfSize) / segmentSize;
    let gridZ = (z + halfSize) / segmentSize;

    // Clamp
    if (gridX < 0) gridX = 0;
    if (gridX >= size) gridX = size - 0.001;
    if (gridZ < 0) gridZ = 0;
    if (gridZ >= size) gridZ = size - 0.001;

    // Integer parts
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, size);
    const z1 = Math.min(z0 + 1, size);

    // Fractional parts
    const tx = gridX - x0;
    const tz = gridZ - z0;

    // Heights
    // Note: PlaneGeometry vertex ordering might map X/Z differently than my array [x][z]
    // Verify visualization. If it looks rotated, swap here.
    const h00 = heightMap[x0][z0];
    const h10 = heightMap[x1][z0];
    const h01 = heightMap[x0][z1];
    const h11 = heightMap[x1][z1];

    // Bilinear Interpolation
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;

    return h0 * (1 - tz) + h1 * tz;
}

function getTerrainNormal(x, z) {
    if (!terrainData) return new THREE.Vector3(0, 1, 0);
    const EPSILON = 0.5;
    const hL = getTerrainHeight(x - EPSILON, z);
    const hR = getTerrainHeight(x + EPSILON, z);
    const hD = getTerrainHeight(x, z + EPSILON); // Down (Z+)
    const hU = getTerrainHeight(x, z - EPSILON); // Up (Z-)

    // Normal = cross vectors
    const v1 = new THREE.Vector3(2 * EPSILON, hR - hL, 0);
    const v2 = new THREE.Vector3(0, hD - hU, 2 * EPSILON);

    // Cross product approach v2 x v1 (approx)
    const normal = new THREE.Vector3();
    normal.crossVectors(v2, v1).normalize();

    return normal;
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

    if (controls.isLocked === true || isTouchDevice) {

        // --- Physics / Movement ---
        raycaster.ray.origin.copy(camera.position);
        raycaster.ray.origin.y -= 2;

        // 1. Friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // 2. Gravity
        velocity.y -= GRAVITY * delta;

        // 3. Input
        // Combine Keyboard (Discrete) + Joystick (Analog)
        let inputZ = Number(moveForward) - Number(moveBackward);
        let inputX = Number(moveRight) - Number(moveLeft);

        // Add Joystick Input
        if (Math.abs(joystickMoveVector.y) > 0) inputZ = joystickMoveVector.y;
        if (Math.abs(joystickMoveVector.x) > 0) inputX = joystickMoveVector.x;

        direction.z = inputZ; // NippleJS Y is forward (up) matches our needs (usually)
        direction.x = inputX;

        // Normalize only if using keyboard boundaries, but for analog we want speed variability?
        // Actually simple normalize is safer for now to avoid super speed dial
        if (inputZ !== 0 || inputX !== 0) direction.normalize();

        if (Math.abs(direction.z) > 0) velocity.z -= direction.z * 400.0 * delta;
        if (Math.abs(direction.x) > 0) velocity.x -= direction.x * 400.0 * delta;

        // Mobile Look (Velocity Based)
        if (Math.abs(joystickLookVector.x) > 0 || Math.abs(joystickLookVector.y) > 0) {
            const LOOK_SPEED = 2.0;
            camera.rotation.y -= joystickLookVector.x * LOOK_SPEED * delta;
            // Inverted Y for natural "Up is Up" look
            camera.rotation.x += joystickLookVector.y * LOOK_SPEED * delta;
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        }

        // 4. Move
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += (velocity.y * delta);

        // 5. Floor Collision / Terrain Following
        const terrainH = getTerrainHeight(camera.position.x, camera.position.z);
        const playerHeight = 2.0; // Eye level

        if (camera.position.y < terrainH + playerHeight) {
            velocity.y = 0;
            camera.position.y = terrainH + playerHeight;
            canJump = true;
        } else if (canJump && velocity.y <= 0 && camera.position.y < terrainH + playerHeight + 1.0) {
            // Snap to ground (prevent slope hopping)
            velocity.y = 0;
            camera.position.y = terrainH + playerHeight;
            canJump = true;
        } else {
            // Truly in air
            canJump = false;
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

        if (p.position.length() > 2000) { // Increased from 200 to 2000
            scene.remove(p);
            projectiles.splice(i, 1);
        }
    }

    // --- Animal Interpolation ---
    const LERP_FACTOR = 10.0 * delta; // Adjust speed
    Object.values(remoteAnimals).forEach(mesh => {
        if (mesh.userData.targetPosition) {
            mesh.position.lerp(mesh.userData.targetPosition, LERP_FACTOR);
        }
        if (mesh.userData.targetRotation !== undefined) {
            // Simple scalar lerp for Y rotation
            // Handle wrapping? e.g. -PI to PI. 
            // Small optimization: check shortest path.
            let current = mesh.rotation.y;
            let target = mesh.userData.targetRotation;

            // Shortest path logic
            if (target - current > Math.PI) target -= Math.PI * 2;
            if (target - current < -Math.PI) target += Math.PI * 2;

            mesh.rotation.y += (target - current) * LERP_FACTOR;
        }

        // --- Normal Alignment ---
        // Calculate normal at CURRENT position (interpolated)
        const normal = getTerrainNormal(mesh.position.x, mesh.position.z);

        // Align 'Up' to normal
        // Strategy: Create a quaternion that rotates from (0,1,0) to 'normal'
        // Then multiply that into the mesh determination.
        // BUT, we already set rotation.y manually for direction.
        // Combining Y-rotation (direction) and surface alignment (tilt) requires care.
        // Easier approach: Use LookAt logic?
        // Or: Construct basis vectors.
        // Up = normal
        // Forward = ... current direction vector but projected on plane?
        // Let's try simple quaternion alignment:

        const currentUp = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(currentUp, normal);

        // We need to apply this TILT on top of the Y-rotation.
        // Y-rotation happens around local Y? No, world Y usually.
        // If we set mesh.rotation.y, we are setting Euler.
        // Let's construct the full quaternion.

        // 1. Rotation for direction (Y-axis)
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mesh.rotation.y);

        // 2. Combine: Tilt * Yaw
        mesh.quaternion.multiplyQuaternions(quaternion, qYaw);

        // Note: usage of mesh.rotation.y above in lerp sets the euler.
        // Overwriting mesh.quaternion works, BUT next frame mesh.rotation.y will read back from the quaternion?
        // Or we should separate the "target yaw" from the actual object rotation.
        // For simplicity: We Lerp the YAW stored in userdata, then reconstruct Quaternion each frame.

        // Fix: Don't read mesh.rotation.y for Lerp logic if we overwrite quaternion?
        // Let's store 'currentYaw' in userdata too?
        if (mesh.userData.currentYaw === undefined) mesh.userData.currentYaw = mesh.rotation.y;

        // Lerp Yaw
        if (mesh.userData.targetRotation !== undefined) {
            let current = mesh.userData.currentYaw;
            let target = mesh.userData.targetRotation;
            if (target - current > Math.PI) target -= Math.PI * 2;
            if (target - current < -Math.PI) target += Math.PI * 2;
            mesh.userData.currentYaw += (target - current) * LERP_FACTOR;
        }

        const qYawinterpolated = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mesh.userData.currentYaw);
        mesh.quaternion.multiplyQuaternions(quaternion, qYawinterpolated);
    });

    prevTime = time;

    renderer.render(scene, camera);
    stats.end();
}
