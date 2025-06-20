import * as THREE from 'three';
import * as C from './constants.js';
import { world, getBlock } from './world.js';
import { blockTypes } from './blocks.js';

export class WorldRenderer {
    constructor(scene) {
        this.scene = scene;
        this.meshes = {};
        this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    // The main function to create/update the world's visual representation
    update() {
        // Clear existing meshes
        for (const typeId in this.meshes) {
            this.scene.remove(this.meshes[typeId]);
            this.meshes[typeId].geometry.dispose();
        }
        this.meshes = {};

        console.log("Updating world mesh...");
        const instances = {};
        for (const typeId in blockTypes) {
            instances[typeId] = [];
        }

        for (let x = 0; x < C.worldWidth; x++) {
            for (let y = 0; y < C.worldHeight; y++) {
                for (let z = 0; z < C.worldDepth; z++) {
                    const blockType = getBlock(x, y, z);
                    if (blockType === 0) continue;

                    // Culling: check for adjacent air blocks
                    if (
                        getBlock(x + 1, y, z) === 0 || getBlock(x - 1, y, z) === 0 ||
                        getBlock(x, y + 1, z) === 0 || getBlock(x, y - 1, z) === 0 ||
                        getBlock(x, y, z + 1) === 0 || getBlock(x, y, z - 1) === 0
                    ) {
                        const matrix = new THREE.Matrix4().makeTranslation(x + 0.5, y + 0.5, z + 0.5);
                        instances[blockType].push(matrix);
                    }
                }
            }
        }

        for (const typeId in instances) {
            if (instances[typeId].length > 0) {
                const material = blockTypes[typeId].material;
                const mesh = new THREE.InstancedMesh(this.blockGeometry, material, instances[typeId].length);

                for (let i = 0; i < instances[typeId].length; i++) {
                    mesh.setMatrixAt(i, instances[typeId][i]);
                }
                this.scene.add(mesh);
                this.meshes[typeId] = mesh;
            }
        }
        console.log("Mesh update complete.");
    }
}
