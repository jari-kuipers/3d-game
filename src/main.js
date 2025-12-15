import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import Stats from 'stats.js';

// --- Configuration ---
const SCENE_COLOR = 0x87CEEB; // Sky blue
const GROUND_COLOR = 0x228B22; // Forest green
const BOX_COLOR = 0xff0000;
const MOVEMENT_SPEED = 10.0;
const JUMP_FORCE = 30.0;
const GRAVITY = 100.0; // Adjusted for mass-like feel

// --- Globals ---
let camera, scene, renderer, controls, stats;
const objects = [];
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

init();
// animate(); removed, handled by setAnimationLoop in init

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


    // 6. Raycast (for simple collision detection, specifically floor)
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
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function shoot() {
    const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();

    // Start at camera position (roughly gun barrel)
    projectile.position.copy(camera.position);

    // Get direction camera is facing
    const direction = new THREE.Vector3();
    controls.getDirection(direction);

    // Slightly offset forward so we don't hit ourselves
    projectile.position.addScaledVector(direction, 2);

    projectile.userData = { velocity: direction.multiplyScalar(PROJECTILE_SPEED) };

    scene.add(projectile);
    projectiles.push(projectile);
}

function animate() {
    // requestAnimationFrame(animate); removed
    stats.begin();

    const time = performance.now();
    const delta = (time - prevTime) / 1000;


    if (controls.isLocked === true) {

        // --- Physics / Movement ---
        raycaster.ray.origin.copy(camera.position);
        raycaster.ray.origin.y -= 2; // Offset for player height leg

        // Check floor/collision
        // Simple "is on ground" check by casting ray down
        // For production we'd want better collision with objects


        // 1. Friction / Damping
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // 2. Gravity
        velocity.y -= GRAVITY * delta;

        // 3. Movement Input (WASD)
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        // 4. Apply Velocity (Horizontal)
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // 5. Apply Velocity (Vertical) & Collision
        camera.position.y += (velocity.y * delta);

        // Ground Collision
        if (camera.position.y < 2) {
            velocity.y = 0;
            camera.position.y = 2; // Hard floor
            canJump = true;
        }
    }

    // --- Projectiles ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.position.addScaledVector(p.userData.velocity, delta);

        // Simple Cleanup (if too far)
        if (p.position.length() > 200) {
            scene.remove(p);
            projectiles.splice(i, 1);
        }
    }


    prevTime = time;

    renderer.render(scene, camera);
    stats.end();
}
