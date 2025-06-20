import * as THREE from 'three';
import { setBlock } from './chunk.js';
import * as C from './constants.js';

export class Interaction {
    constructor(camera, scene, player, chunks) {
        this.camera = camera;
        this.scene = scene;
        this.player = player;
        this.chunks = chunks;
        this.raycaster = new THREE.Raycaster();
        this.intersectedBlock = null;

        this.highlightMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.01, 1.01, 1.01),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false })
        );
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);
    }
    
    update() {
        if (!this.player.controls.isLocked) {
             this.highlightMesh.visible = false;
             return;
        }
        
        this.raycaster.far = C.playerReach; 
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        const chunkMeshes = [...this.chunks.values()].map(c => c.mesh).filter(m => m);
        const intersects = this.raycaster.intersectObjects(chunkMeshes);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const position = new THREE.Vector3().copy(intersection.point).addScaledVector(intersection.face.normal, -0.5);
            
            const blockPos = {
                x: Math.floor(position.x),
                y: Math.floor(position.y),
                z: Math.floor(position.z)
            };
            
            this.highlightMesh.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);
            this.highlightMesh.visible = true;
            this.intersectedBlock = { position: blockPos, normal: intersection.face.normal };
        } else {
            this.highlightMesh.visible = false;
            this.intersectedBlock = null;
        }
    }

    handleMouseClick(event) {
        if (!this.player.controls.isLocked || !this.intersectedBlock) return;
        const { position, normal } = this.intersectedBlock;

        if (event.button === 0) { // Left Click: Break
            setBlock(position.x, position.y, position.z, 0);
        } else if (event.button === 2) { // Right Click: Place
            const placePos = {
                x: position.x + normal.x,
                y: position.y + normal.y,
                z: position.z + normal.z,
            };

            const newBlockBounds = new THREE.Box3(
                new THREE.Vector3(placePos.x, placePos.y, placePos.z),
                new THREE.Vector3(placePos.x + 1, placePos.y + 1, placePos.z + 1)
            );

            if (this.player.bounds.intersectsBox(newBlockBounds)) {
                return;
            }

            const selectedBlockId = this.player.getHotbarSelection();
            setBlock(placePos.x, placePos.y, placePos.z, selectedBlockId);
        }
    }
}
