import * as THREE from 'three';
import { setBlock } from './world.js';
import * as C from './constants.js'; // Import constants

export class Interaction {
    constructor(camera, scene, worldRenderer, player) {
        this.camera = camera;
        this.scene = scene;
        this.worldRenderer = worldRenderer;
        this.player = player;
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
        
        // --- SET PLAYER REACH LIMIT ---
        this.raycaster.far = C.playerReach; 
        
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(Object.values(this.worldRenderer.meshes));

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const instanceId = intersection.instanceId;
            const mesh = intersection.object;
            const matrix = new THREE.Matrix4();
            mesh.getMatrixAt(instanceId, matrix);
            const position = new THREE.Vector3().setFromMatrixPosition(matrix);
            
            const blockPos = {
                x: Math.round(position.x - 0.5),
                y: Math.round(position.y - 0.5),
                z: Math.round(position.z - 0.5)
            };
            
            this.highlightMesh.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);
            this.highlightMesh.visible = true;
            this.intersectedBlock = { position: blockPos, normal: intersection.face.normal };
        } else {
            this.highlightMesh.visible = false;
            this.intersectedBlock = null;
        }
    }

    // --- handleMouseClick remains unchanged ---
    handleMouseClick(event) {
        if (!this.player.controls.isLocked || !this.intersectedBlock) return;
        const { position, normal } = this.intersectedBlock;

        if (event.button === 0) { // Left Click: Break
            setBlock(position.x, position.y, position.z, 0);
            this.worldRenderer.update();
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
            this.worldRenderer.update();
        }
    }
}
