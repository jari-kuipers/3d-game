import { io } from 'socket.io-client';

/**
 * Wrapper around Socket.io client with common game networking patterns
 */
export class NetworkClient {
    constructor(serverUrl) {
        const url = serverUrl || (import.meta.env?.DEV
            ? `http://${window.location.hostname}:3000`
            : '/');

        this.socket = io(url);
        this.eventHandlers = new Map();

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });
    }

    /**
     * Register an event handler
     */
    on(event, handler) {
        this.socket.on(event, handler);

        // Store for potential cleanup
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Emit an event to the server
     */
    emit(event, data) {
        this.socket.emit(event, data);
    }

    /**
     * Send player movement update
     */
    sendMovement(position, rotation) {
        if (this.socket.connected) {
            this.socket.emit('playerMovement', {
                x: position.x,
                y: position.y,
                z: position.z,
                rotation: rotation.y, // Yaw
                rx: rotation.x // Pitch
            });
        }
    }

    /**
     * Get socket ID
     */
    get id() {
        return this.socket.id;
    }

    /**
     * Check if connected
     */
    get connected() {
        return this.socket.connected;
    }

    /**
     * Join a specific room
     */
    joinRoom(roomCode) {
        if (this.socket.connected) {
            this.socket.emit('joinRoom', roomCode);
        } else {
            this.socket.on('connect', () => {
                this.socket.emit('joinRoom', roomCode);
            });
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this.socket.disconnect();
    }
}
