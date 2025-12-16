import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/**
 * Core game engine managing scene, camera, renderer, and animation loop
 */
export class GameEngine {
    constructor(config = {}) {
        this.config = {
            sceneColor: config.sceneColor || 0x87CEEB,
            fogDistance: config.fogDistance || 750,
            ...config
        };

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        this.controls = new PointerLockControls(this.camera, document.body);

        this.animationCallbacks = [];
        this.isRunning = false;

        this.init();
    }

    init() {
        // Scene setup
        this.scene.background = new THREE.Color(this.config.sceneColor);
        this.scene.fog = new THREE.Fog(this.config.sceneColor, 0, this.config.fogDistance);

        // Camera setup
        this.camera.rotation.order = 'YXZ'; // Prevents gimbal lock
        this.camera.position.y = 2; // Eye level

        // Renderer setup
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Add camera to scene
        this.scene.add(this.camera);

        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());

        // Add default lighting
        const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
        light.position.set(0.5, 1, 0.75);
        this.scene.add(light);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Register a callback to be called each animation frame
     * @param {Function} callback - Function called with (delta, time) parameters
     */
    onAnimate(callback) {
        this.animationCallbacks.push(callback);
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.prevTime = performance.now();
        this.renderer.setAnimationLoop((time) => this.animate(time));
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this.isRunning = false;
        this.renderer.setAnimationLoop(null);
    }

    animate(time) {
        const delta = (time - this.prevTime) / 1000;
        this.prevTime = time;

        // Call all registered animation callbacks
        this.animationCallbacks.forEach(callback => callback(delta, time));

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Setup pointer lock controls with instructions element
     */
    setupPointerLock(instructionsElement) {
        if (!instructionsElement) return;

        instructionsElement.addEventListener('click', () => {
            this.controls.lock();
        });

        this.controls.addEventListener('lock', () => {
            instructionsElement.style.display = 'none';
            instructionsElement.style.opacity = 0;
        });

        this.controls.addEventListener('unlock', () => {
            instructionsElement.style.display = '';
            instructionsElement.style.opacity = 1;
        });
    }
}
