export class DungeonGenerator {
    constructor() {
        this.rooms = [];
        this.corridors = [];
    }

    /**
     * Generates a 3D dungeon
     * @param {number} size 
     * @returns {Object} Dungeon data
     */
    /**
     * Generates a 3D dungeon
     * @param {number} size - Approximate area to cover
     * @returns {Object} Dungeon data with rooms and corridors
     */
    generate(size) {
        this.rooms = [];
        this.corridors = [];
        const ROOM_COUNT = 10;
        const MIN_ROOM_SIZE = 5;
        const MAX_ROOM_SIZE = 15;

        // Start room
        const startRoom = {
            id: 0,
            x: 0,
            y: 0,
            z: 0,
            width: 10,
            height: 5,
            depth: 10,
            type: 'room',
            connections: []
        };
        this.rooms.push(startRoom);

        // Simple random generation (overlapping for now, to be refined)
        for (let i = 1; i < ROOM_COUNT; i++) {
            const prevRoom = this.rooms[this.rooms.length - 1];

            // Random direction
            const direction = Math.floor(Math.random() * 4); // 0: +x, 1: -x, 2: +z, 3: -z
            const corridorLength = 5 + Math.floor(Math.random() * 10);

            const corridor = {
                id: `c_${i}`,
                type: 'corridor',
                width: 4,
                height: 4,
                length: corridorLength,
                direction: direction
            };

            // Position corridor based on prev room
            // Ideally we attach to a specific wall.
            // Simplified: extend from center for visualization
            let cx = prevRoom.x;
            let cy = prevRoom.y; // Flat for now
            let cz = prevRoom.z;

            // Offset to edge of room
            if (direction === 0) { cx += prevRoom.width / 2 + corridorLength / 2; }
            else if (direction === 1) { cx -= prevRoom.width / 2 + corridorLength / 2; }
            else if (direction === 2) { cz += prevRoom.depth / 2 + corridorLength / 2; }
            else if (direction === 3) { cz -= prevRoom.depth / 2 + corridorLength / 2; }

            corridor.x = cx;
            corridor.y = cy;
            corridor.z = cz;

            // Dimensions for rendering box
            if (direction === 0 || direction === 1) {
                corridor.boxWidth = corridorLength;
                corridor.boxDepth = 4;
            } else {
                corridor.boxWidth = 4;
                corridor.boxDepth = corridorLength;
            }
            corridor.boxHeight = 4;

            this.corridors.push(corridor);

            // Add connection to prevRoom
            prevRoom.connections.push({
                x: cx - (direction === 0 ? corridorLength / 2 : (direction === 1 ? -corridorLength / 2 : 0)),
                z: cz - (direction === 2 ? corridorLength / 2 : (direction === 3 ? -corridorLength / 2 : 0)),
                // The point on the wall where the corridor starts
                // Re-calculating contact point:
                // If dir 0 (+x), contact is on Right wall of prevRoom
                // contact x = prevRoom.x + prevRoom.width/2
                // contact z = prevRoom.z
                width: 4,
                height: 4,
                direction: direction // Outgoing direction
            });

            // New Room at end of corridor
            const newRoom = {
                id: i,
                width: MIN_ROOM_SIZE + Math.random() * (MAX_ROOM_SIZE - MIN_ROOM_SIZE),
                height: 5 + Math.random() * 5, // Random height
                depth: MIN_ROOM_SIZE + Math.random() * (MAX_ROOM_SIZE - MIN_ROOM_SIZE),
                type: 'room',
                connections: []
            };

            let rx = cx;
            let ry = cy; // Still flat
            let rz = cz;

            if (direction === 0) { rx += corridorLength / 2 + newRoom.width / 2; }
            else if (direction === 1) { rx -= corridorLength / 2 + newRoom.width / 2; }
            else if (direction === 2) { rz += corridorLength / 2 + newRoom.depth / 2; }
            else if (direction === 3) { rz -= corridorLength / 2 + newRoom.depth / 2; }

            // Randomly go up or down sometimes
            if (Math.random() > 0.7) {
                ry += (Math.random() > 0.5 ? 5 : -5);
            }

            newRoom.x = rx;
            newRoom.y = ry;
            newRoom.z = rz;

            // Connection at entry (opposite of outgoing)
            // If dir was 0 (+x), we entered on Left wall of newRoom
            // contact x = newRoom.x - newRoom.width/2
            newRoom.connections.push({
                x: rx - (direction === 0 ? newRoom.width / 2 : (direction === 1 ? -newRoom.width / 2 : 0)),
                z: rz - (direction === 2 ? newRoom.depth / 2 : (direction === 3 ? -newRoom.depth / 2 : 0)),
                width: 4,
                height: 4,
                direction: (direction + 2) % 4 // Incoming
            });

            this.rooms.push(newRoom);
        }

        return {
            rooms: this.rooms,
            corridors: this.corridors
        };
    }
}
