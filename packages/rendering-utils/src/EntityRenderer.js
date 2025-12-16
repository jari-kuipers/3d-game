import * as THREE from 'three';

/**
 * Entity rendering utilities for players, animals, and objects
 */
export class EntityRenderer {
    /**
     * Create a name tag sprite for a player
     */
    static createNameTag(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, 256, 64);

        context.font = 'Bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(name, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        sprite.scale.set(4, 1, 1); // 256/64 = 4:1 aspect ratio

        return sprite;
    }

    /**
     * Create a sheep mesh (Minecraft-style)
     */
    static createSheepMesh() {
        const group = new THREE.Group();

        // Materials
        const whiteWool = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const skin = new THREE.MeshStandardMaterial({ color: 0xeebb99 });
        const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.7, 1.6, 2.6);
        const body = new THREE.Mesh(bodyGeo, whiteWool);
        body.position.y = 1.5;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        const head = new THREE.Mesh(headGeo, skin);
        head.position.set(0, 2.2, 1.3);
        group.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, black);
        leftEye.position.set(-0.3, 0.1, 0.51);
        head.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, black);
        rightEye.position.set(0.3, 0.1, 0.51);
        head.add(rightEye);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const legPositions = [
            { x: -0.5, z: 0.8 },  // Front Left
            { x: 0.5, z: 0.8 },   // Front Right
            { x: -0.5, z: -0.8 }, // Back Left
            { x: 0.5, z: -0.8 }   // Back Right
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, skin);
            leg.position.set(pos.x, 0.4, pos.z);
            group.add(leg);
        });

        return group;
    }

    /**
     * Create a player mesh (simple box)
     */
    static createPlayerMesh() {
        const geometry = new THREE.BoxGeometry(2, 4, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        return new THREE.Mesh(geometry, material);
    }

    /**
     * Load trees into the scene
     */
    static loadTrees(scene, trees, collidables = null) {
        const trunkGeometry = new THREE.CylinderGeometry(1.5, 1.5, 15, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

        const leavesGeometry = new THREE.ConeGeometry(9, 24, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });

        trees.forEach(tree => {
            const treeGroup = new THREE.Group();
            treeGroup.position.set(tree.x, tree.y, tree.z);

            // Trunk
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 7.5; // Half height (15 / 2)
            treeGroup.add(trunk);

            // Leaves
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 21; // Trunk height + half leaves - overlap
            treeGroup.add(leaves);

            scene.add(treeGroup);

            // Add to collidables if provided
            if (collidables) {
                collidables.push({ x: tree.x, z: tree.z, radius: 2.0 });
            }
        });

        console.log(`Loaded ${trees.length} trees.`);
    }
}
