import * as THREE from 'three';

export class DungeonRenderer {
    constructor(scene) {
        this.scene = scene;
        this.dungeonMesh = new THREE.Group();
        this.scene.add(this.dungeonMesh);
    }

    loadDungeon(dungeonData) {
        this.dungeonData = dungeonData; // Store for collision

        // Clear previous
        this.dungeonMesh.clear();

        const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        dungeonData.rooms.forEach(room => {
            this.createRoomWalls(room, material);

            // Add light to room
            const light = new THREE.PointLight(0xffaa00, 0.5, 20);
            light.position.set(room.x, room.y, room.z);
            this.dungeonMesh.add(light);
        });

        dungeonData.corridors.forEach(corridor => {
            const geometry = new THREE.BoxGeometry(corridor.boxWidth, corridor.boxHeight, corridor.boxDepth);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(corridor.x, corridor.y, corridor.z);
            this.dungeonMesh.add(mesh);
        });
    }

    createRoomWalls(room, material) {
        const halfW = room.width / 2;
        const halfH = room.height / 2;
        const halfD = room.depth / 2;

        // Floor (solid)
        const floorGeo = new THREE.PlaneGeometry(room.width, room.depth);
        const floor = new THREE.Mesh(floorGeo, material);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(room.x, room.y - halfH, room.z);
        this.dungeonMesh.add(floor);

        // Ceiling (solid)
        const ceilGeo = new THREE.PlaneGeometry(room.width, room.depth);
        const ceiling = new THREE.Mesh(ceilGeo, material);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(room.x, room.y + halfH, room.z);
        this.dungeonMesh.add(ceiling);

        // Walls
        // To handle holes, we just build multiple planes if there is a hole.
        // Simplified: 4 walls. check room.connections for openings on each wall.

        // North Wall (-z direction, z = room.z - halfD)
        this.buildWall(room, material, 'north', room.x, room.y, room.z - halfD, room.width, room.height, 0);

        // South Wall (+z direction, z = room.z + halfD)
        this.buildWall(room, material, 'south', room.x, room.y, room.z + halfD, room.width, room.height, Math.PI);

        // East Wall (+x direction, x = room.x + halfW)
        this.buildWall(room, material, 'east', room.x + halfW, room.y, room.z, room.depth, room.height, -Math.PI / 2);

        // West Wall (-x direction, x = room.x - halfW)
        this.buildWall(room, material, 'west', room.x - halfW, room.y, room.z, room.depth, room.height, Math.PI / 2);
    }

    buildWall(room, material, side, x, y, z, width, height, rotationY) {
        // Find connections on this side
        // connections store x/z in world space.
        // We need to map them to 1D position along the wall [-width/2, width/2]

        const connections = room.connections || [];
        const openings = [];

        connections.forEach(conn => {
            // Check if connection matches this side
            // 0: +x (East), 1: -x (West), 2: +z (South), 3: -z (North)
            // But connections are just points.
            // North wall: z matches conn.z approx, x is variable
            // South wall: z matches conn.z approx
            // East wall: x matches conn.x approx

            const TOLERANCE = 0.1;
            const halfW = room.width / 2;
            const halfD = room.depth / 2;

            let isMatch = false;
            let centerPos = 0; // Relative to wall center

            if (side === 'north' && Math.abs(conn.z - (room.z - halfD)) < TOLERANCE) {
                isMatch = true;
                centerPos = conn.x - room.x; // x is the varying axis
            } else if (side === 'south' && Math.abs(conn.z - (room.z + halfD)) < TOLERANCE) {
                isMatch = true;
                centerPos = -(conn.x - room.x); // Inverted due to rotation? Let's check coord sys.
                // Assuming standard PlaneGeometry faces +Z.
                // North wall (Back): Rot 0. Local +X is World +X.
                // South wall (Front): Rot PI. Local +X is World -X.
                centerPos = -(conn.x - room.x);
            } else if (side === 'east' && Math.abs(conn.x - (room.x + halfW)) < TOLERANCE) {
                isMatch = true;
                centerPos = (conn.z - room.z);
                // East: Rot -PI/2. Local +X is World +Z. 
            } else if (side === 'west' && Math.abs(conn.x - (room.x - halfW)) < TOLERANCE) {
                isMatch = true;
                centerPos = -(conn.z - room.z);
                // West: Rot PI/2. Local +X is World -Z.
            }

            if (isMatch) {
                openings.push({ pos: centerPos, width: conn.width, height: conn.height });
            }
        });

        if (openings.length === 0) {
            // Solid wall
            const geo = new THREE.PlaneGeometry(width, height);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotationY;
            this.dungeonMesh.add(mesh);
        } else {
            // Subdivide
            // Sort openings by position
            openings.sort((a, b) => a.pos - b.pos);

            let currentX = -width / 2;

            openings.forEach(op => {
                const opStart = op.pos - op.width / 2;
                const opEnd = op.pos + op.width / 2;

                // Segment before opening
                if (opStart > currentX) {
                    const segW = opStart - currentX;
                    const geo = new THREE.PlaneGeometry(segW, height);
                    const mesh = new THREE.Mesh(geo, material);

                    // Center of segment
                    const localX = currentX + segW / 2;

                    // Transforms need to be applied manually since we are in world space func but building logic in local
                    const container = new THREE.Group();
                    container.position.set(x, y, z);
                    container.rotation.y = rotationY;

                    mesh.position.x = localX;
                    container.add(mesh);
                    this.dungeonMesh.add(container);
                }

                // Segment ABOVE opening (Lintel)
                if (op.height < height) {
                    const lintelH = height - op.height;
                    const geo = new THREE.PlaneGeometry(op.width, lintelH);
                    const mesh = new THREE.Mesh(geo, material);

                    const localX = op.pos;
                    const localY = (height / 2) - (lintelH / 2); // Top align

                    const container = new THREE.Group();
                    container.position.set(x, y, z);
                    container.rotation.y = rotationY;

                    mesh.position.set(localX, localY, 0);
                    container.add(mesh);
                    this.dungeonMesh.add(container);
                }

                currentX = opEnd;
            });

            // Final segment
            if (currentX < width / 2) {
                const segW = (width / 2) - currentX;
                const geo = new THREE.PlaneGeometry(segW, height);
                const mesh = new THREE.Mesh(geo, material);

                const localX = currentX + segW / 2;

                const container = new THREE.Group();
                container.position.set(x, y, z);
                container.rotation.y = rotationY;

                mesh.position.x = localX;
                container.add(mesh);
                this.dungeonMesh.add(container);
            }
        }
    }
    /**
     * Get the floor height at position x, z
     * Used by PhysicsController
     */
    getHeight(x, z) {
        if (!this.dungeonData) return -100;

        // Check rooms
        for (const room of this.dungeonData.rooms) {
            const halfW = room.width / 2;
            const halfD = room.depth / 2;

            if (x >= room.x - halfW && x <= room.x + halfW &&
                z >= room.z - halfD && z <= room.z + halfD) {
                // Return floor height (assuming room origin is center)
                return room.y - (room.height / 2) + 0.1; // +0.1 to stay above floor slightly
            }
        }

        // Check corridors
        for (const cor of this.dungeonData.corridors) {
            const halfW = cor.boxWidth / 2;
            const halfD = cor.boxDepth / 2;

            if (x >= cor.x - halfW && x <= cor.x + halfW &&
                z >= cor.z - halfD && z <= cor.z + halfD) {
                return cor.y - (cor.boxHeight / 2) + 0.1;
            }
        }

        return -100; // Void
    }
}
