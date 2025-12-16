import * as THREE from 'three';
import nipplejs from 'nipplejs';

/**
 * Manages keyboard, mouse, and mobile touch input
 */
export class InputManager {
    constructor() {
        // Keyboard state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;

        // Mobile joystick state
        this.joystickLookVector = new THREE.Vector2(0, 0);
        this.joystickMoveVector = new THREE.Vector2(0, 0);

        // Device detection
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        this.initKeyboardListeners();
        this.initMobileControls();
    }

    initKeyboardListeners() {
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'Space':
                this.canJump = true;
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
            case 'Space':
                this.canJump = false;
                break;
        }
    }

    initMobileControls() {
        if (!this.isTouchDevice) return;

        // Left joystick (movement)
        const zoneLeft = document.getElementById('zone_joystick_left');
        if (zoneLeft) {
            const managerLeft = nipplejs.create({
                zone: zoneLeft,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'white'
            });

            managerLeft.on('move', (evt, data) => {
                this.joystickMoveVector.set(data.vector.x, data.vector.y);
            });

            managerLeft.on('end', () => {
                this.joystickMoveVector.set(0, 0);
            });
        }

        // Right joystick (look)
        const zoneRight = document.getElementById('zone_joystick_right');
        if (zoneRight) {
            const managerRight = nipplejs.create({
                zone: zoneRight,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'white'
            });

            managerRight.on('move', (evt, data) => {
                this.joystickLookVector.set(data.vector.x, data.vector.y);
            });

            managerRight.on('end', () => {
                this.joystickLookVector.set(0, 0);
            });
        }
    }

    /**
     * Get normalized input direction combining keyboard and joystick
     */
    getInputDirection() {
        let inputZ = Number(this.moveForward) - Number(this.moveBackward);
        let inputX = Number(this.moveRight) - Number(this.moveLeft);

        // Add joystick input (overrides keyboard if active)
        if (Math.abs(this.joystickMoveVector.y) > 0) inputZ = this.joystickMoveVector.y;
        if (Math.abs(this.joystickMoveVector.x) > 0) inputX = this.joystickMoveVector.x;

        const direction = new THREE.Vector3(inputX, 0, inputZ);
        if (inputZ !== 0 || inputX !== 0) direction.normalize();

        return direction;
    }
}
