import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as C from './constants.js';
import { getBlock } from './world.js';

export class Player {
    constructor(camera, domElement) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.keys = {};

        // Inventory / Hotbar
        this.hotbar = C.hotbarBlocks;
        this.selectedSlot = 0;

        this.bounds = new THREE.Box3();
        this.halfWidth = C.playerWidth / 2;

        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }
    
    // --- Hotbar Methods ---
    changeSlot(delta) {
        // Use modulo to wrap around the hotbar slots
        this.selectedSlot = (this.selectedSlot + delta + this.hotbar.length) % this.hotbar.length;
    }

    getHotbarSelection() {
        return this.hotbar[this.selectedSlot];
    }
    
    // --- Physics and Position Methods ---
    getVoxelPos() {
        return {
            x: Math.floor(this.position.x),
            y: Math.floor(this.position.y),
            z: Math.floor(this.position.z)
        };
    }

    updateBounds() {
        // Player's position is their feet, but bounding box is centered vertically
        const center = new THREE.Vector3(this.position.x, this.position.y + C.playerHeight / 2, this.position.z);
        const size = new THREE.Vector3(C.playerWidth, C.playerHeight, C.playerWidth);
        this.bounds.setFromCenterAndSize(center, size);
    }
    
    checkGrounded() {
        // ... (This method is no longer needed as the Y-collision handles it)
        return this.onGround;
    }
    
    physicsUpdate(deltaTime) {
        // 1. Get player input and determine desired velocity
        const inputVelocity = new THREE.Vector3();
        const moveSpeed = C.playerSpeed;
        
        if (this.controls.isLocked) {
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(this.camera.up, forward).negate();

            if (this.keys['KeyW']) inputVelocity.add(forward);
            if (this.keys['KeyS']) inputVelocity.sub(forward);
            if (this.keys['KeyA']) inputVelocity.add(right);
            if (this.keys['KeyD']) inputVelocity.sub(right);
            
            inputVelocity.normalize().multiplyScalar(moveSpeed);
            
            this.velocity.x = inputVelocity.x;
            this.velocity.z = inputVelocity.z;
        }

        // 2. Apply gravity (always, onGround is determined by collisions)
        this.velocity.y -= C.gravity * deltaTime;

        // 3. Handle jumping
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = C.playerJumpHeight;
        }

        // 4. Apply velocity and handle collisions
        this.onGround = false; // Assume not on ground until Y collision proves otherwise
        this.position.x += this.velocity.x * deltaTime;
        this.handleXCollisions();
        this.position.z += this.velocity.z * deltaTime;
        this.handleZCollisions();
        this.position.y += this.velocity.y * deltaTime;
        this.handleYCollisions();
        
        // 5. Reset if fallen out of the world
        if (this.position.y < -20) {
            this.position.set(C.worldWidth / 2, C.worldHeight + 5, C.worldDepth / 2);
            this.velocity.set(0, 0, 0);
        }
    }

    updateCamera() {
        this.camera.position.copy(this.position);
        this.camera.position.y += C.playerEyeHeight;
    }
    
    // --- COLLISION RESOLUTION (UPDATED) ---
    handleXCollisions() {
        this.updateBounds();
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let y = y1; y <= y2; y++) {
            for (let z = z1; z <= z2; z++) {
                if (this.velocity.x < 0 && getBlock(x1, y, z) !== 0) { // Moving left, hit block
                    this.position.x = x1 + 1 + this.halfWidth;
                    this.velocity.x = 0;
                    this.updateBounds();
                    return;
                }
                if (this.velocity.x > 0 && getBlock(x2, y, z) !== 0) { // Moving right, hit block
                    this.position.x = x2 - this.halfWidth;
                    this.velocity.x = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }
    
    handleZCollisions() {
        this.updateBounds();
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (this.velocity.z < 0 && getBlock(x, y, z1) !== 0) { // Moving "forward"
                    this.position.z = z1 + 1 + this.halfWidth;
                    this.velocity.z = 0;
                    this.updateBounds();
                    return;
                }
                if (this.velocity.z > 0 && getBlock(x, y, z2) !== 0) { // Moving "backward"
                    this.position.z = z2 - this.halfWidth;
                    this.velocity.z = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }

    handleYCollisions() {
        this.updateBounds();
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let x = x1; x <= x2; x++) {
            for (let z = z1; z <= z2; z++) {
                // *** KEY FIX for AUTO-CLIMBING ***
                // Only treat a block as ground if we are falling onto it.
                if (this.velocity.y <= 0 && getBlock(x, y1, z) !== 0) {
                    this.position.y = y1 + 1;
                    this.velocity.y = 0;
                    this.onGround = true; // We have landed on something
                    this.updateBounds();
                    return;
                }
                // Hitting a ceiling
                if (this.velocity.y > 0 && getBlock(x, y2, z) !== 0) {
                    this.position.y = y2 - C.playerHeight;
                    this.velocity.y = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }
}
