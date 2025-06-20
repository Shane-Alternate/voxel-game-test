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
        this.isSprinting = false;
        this.keys = {};

        this.hotbar = C.hotbarBlocks;
        this.selectedSlot = 0;

        this.bounds = new THREE.Box3();
        this.halfWidth = C.playerWidth / 2;

        document.addEventListener('keydown', (e) => this.onKey(e.code, true));
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
    }
    
    onKey(code, isPressed) {
        this.keys[code] = isPressed;
        if (code === 'ControlLeft') {
            this.isSprinting = isPressed;
        }
    }

    // --- Hotbar Methods ---
    selectSlot(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.hotbar.length) {
            this.selectedSlot = slotIndex;
        }
    }

    getHotbarSelection() {
        return this.hotbar[this.selectedSlot];
    }
    
    // --- Physics and Position Methods ---
    updateBounds() {
        this.bounds.min.set(
            this.position.x - this.halfWidth, 
            this.position.y, 
            this.position.z - this.halfWidth
        );
        this.bounds.max.set(
            this.position.x + this.halfWidth, 
            this.position.y + C.playerHeight, 
            this.position.z + this.halfWidth
        );
    }
    
    physicsUpdate(deltaTime) {
        // --- 1. HORIZONTAL MOVEMENT ---
        const targetSpeed = this.isSprinting ? C.sprintSpeed : C.walkSpeed;
        const input = new THREE.Vector3();
        if (this.controls.isLocked) {
            if (this.keys['KeyW']) input.z = -1;
            if (this.keys['KeyS']) input.z = 1;
            if (this.keys['KeyA']) input.x = -1;
            if (this.keys['KeyD']) input.x = 1;
        }

        const isMoving = input.lengthSq() > 0;
        let acceleration = C.horizontalAcceleration;
        
        // Apply camera rotation to input vector
        const euler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
        input.applyEuler(euler);
        
        // If on the ground, apply friction. If in the air, reduce control.
        if (this.onGround) {
            if (!isMoving) {
                // Apply friction to stop
                this.velocity.x -= this.velocity.x * C.horizontalAcceleration * deltaTime;
                this.velocity.z -= this.velocity.z * C.horizontalAcceleration * deltaTime;
            }
        } else {
            acceleration *= C.airControl;
        }

        // Accelerate towards target speed
        if (isMoving) {
            this.velocity.x += input.x * acceleration * deltaTime;
            this.velocity.z += input.z * acceleration * deltaTime;
        }

        // Clamp horizontal velocity to the maximum speed
        const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
        if (horizontalVelocity.length() > targetSpeed) {
            horizontalVelocity.normalize().multiplyScalar(targetSpeed);
            this.velocity.x = horizontalVelocity.x;
            this.velocity.z = horizontalVelocity.y;
        }

        // --- 2. VERTICAL MOVEMENT ---
        // Apply Minecraft-style gravity and drag
        this.velocity.y -= C.gravity * deltaTime;
        this.velocity.y *= Math.pow(C.verticalDrag, deltaTime); // Frame-rate independent drag

        // Jumping
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = C.jumpInitialVelocity;
        }

        // --- 3. APPLY VELOCITY AND CHECK COLLISIONS ---
        this.onGround = false; // Assume not on ground until Y collision proves otherwise
        this.position.x += this.velocity.x * deltaTime;
        this.handleXCollisions();
        this.position.z += this.velocity.z * deltaTime;
        this.handleZCollisions();
        this.position.y += this.velocity.y * deltaTime;
        this.handleYCollisions();
        
        // Reset if fallen out of the world
        if (this.position.y < -20) {
            this.position.set(C.worldWidth / 2, C.worldHeight + 5, C.worldDepth / 2);
            this.velocity.set(0, 0, 0);
        }
    }

    updateCamera() {
        this.camera.position.set(this.position.x, this.position.y + C.playerEyeHeight, this.position.z);
    }
    
    // --- COLLISION RESOLUTION ---
    // (These methods are largely the same as before, just with minor adjustments to use the new bounds)
    handleXCollisions() {
        this.updateBounds();
        // ... (collision logic remains the same as previous step)
    }
    
    handleZCollisions() {
        this.updateBounds();
        // ... (collision logic remains the same as previous step)
    }

    handleYCollisions() {
        this.updateBounds();
        // ... (collision logic remains the same as previous step)
    }
}

// Add the collision methods back in, as they are unchanged from the previous version
// but are too long to repeat here for brevity.
// Copy the handleXCollisions, handleZCollisions, and handleYCollisions methods
// from the previous response's player.js file and paste them here.
// For completion, here they are:
Player.prototype.handleXCollisions = function() {
    this.updateBounds();
    const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
    const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y-0.01)]; // Check slightly below the top
    const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

    for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
            if (this.velocity.x < 0 && getBlock(x1, y, z) !== 0) {
                this.position.x = x1 + 1 + this.halfWidth;
                this.velocity.x = 0;
                this.updateBounds();
                return;
            }
            if (this.velocity.x > 0 && getBlock(x2, y, z) !== 0) {
                this.position.x = x2 - this.halfWidth;
                this.velocity.x = 0;
                this.updateBounds();
                return;
            }
        }
    }
}
Player.prototype.handleZCollisions = function() {
    this.updateBounds();
    const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
    const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y-0.01)];
    const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            if (this.velocity.z < 0 && getBlock(x, y, z1) !== 0) {
                this.position.z = z1 + 1 + this.halfWidth;
                this.velocity.z = 0;
                this.updateBounds();
                return;
            }
            if (this.velocity.z > 0 && getBlock(x, y, z2) !== 0) {
                this.position.z = z2 - this.halfWidth;
                this.velocity.z = 0;
                this.updateBounds();
                return;
            }
        }
    }
}
Player.prototype.handleYCollisions = function() {
    this.updateBounds();
    const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
    const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
    const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

    for (let x = x1; x <= x2; x++) {
        for (let z = z1; z <= z2; z++) {
            if (this.velocity.y <= 0 && getBlock(x, y1, z) !== 0) {
                this.position.y = y1 + 1;
                this.velocity.y = 0;
                this.onGround = true;
                this.updateBounds();
                return;
            }
            if (this.velocity.y > 0 && getBlock(x, y2, z) !== 0) {
                this.position.y = y2 - C.playerHeight;
                this.velocity.y = 0;
                this.updateBounds();
                return;
            }
        }
    }
}
