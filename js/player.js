import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as C from './constants.js';
import { getBlock } from './world.js';

export class Player {
    // ... constructor and other methods remain the same ...
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

    selectSlot(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.hotbar.length) {
            this.selectedSlot = slotIndex;
        }
    }

    getHotbarSelection() {
        return this.hotbar[this.selectedSlot];
    }
    
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
    
    // --- COMPLETELY REWRITTEN PHYSICS UPDATE ---
    physicsUpdate(deltaTime) {
        // --- 1. GATHER INPUT ---
        const input = new THREE.Vector3();
        if (this.controls.isLocked) {
            if (this.keys['KeyW']) input.z = -1;
            if (this.keys['KeyS']) input.z = 1;
            if (this.keys['KeyA']) input.x = -1;
            if (this.keys['KeyD']) input.x = 1;
        }
        
        // --- 2. HORIZONTAL MOVEMENT (ACCELERATION & DRAG) ---
        const drag = this.onGround ? C.groundDrag : C.airDrag;
        const targetSpeed = this.isSprinting ? C.sprintSpeed : C.walkSpeed;

        // Apply drag to slow down the player
        this.velocity.x -= this.velocity.x * drag * deltaTime;
        this.velocity.z -= this.velocity.z * drag * deltaTime;

        if (input.lengthSq() > 0) {
            input.normalize();
            
            // Rotate input vector to match camera direction
            const euler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
            input.applyEuler(euler);

            // Accelerate the player
            this.velocity.x += input.x * C.horizontalAcceleration * deltaTime;
            this.velocity.z += input.z * C.horizontalAcceleration * deltaTime;
        }
        
        // Clamp horizontal velocity to the maximum speed
        const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
        if (horizontalVelocity.length() > targetSpeed) {
            horizontalVelocity.normalize().multiplyScalar(targetSpeed);
            this.velocity.x = horizontalVelocity.x;
            this.velocity.z = horizontalVelocity.y;
        }

        // --- 3. VERTICAL MOVEMENT (GRAVITY, DRAG & JUMP) ---
        this.velocity.y -= C.gravity * deltaTime;
        this.velocity.y *= Math.pow(C.verticalDrag, deltaTime);

        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = C.jumpInitialVelocity;
        }

        // --- 4. APPLY VELOCITY AND CHECK COLLISIONS ---
        this.onGround = false;
        this.position.x += this.velocity.x * deltaTime;
        this.handleXCollisions();
        this.position.z += this.velocity.z * deltaTime;
        this.handleZCollisions();
        this.position.y += this.velocity.y * deltaTime;
        this.handleYCollisions();
        
        if (this.position.y < -20) {
            this.position.set(C.worldWidth / 2, C.worldHeight + 5, C.worldDepth / 2);
            this.velocity.set(0, 0, 0);
        }
    }

    updateCamera() {
        this.camera.position.set(this.position.x, this.position.y + C.playerEyeHeight, this.position.z);
    }
    
    // --- Collision methods remain unchanged ---
    handleXCollisions() {
        this.updateBounds();
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y-0.01)];
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
    handleZCollisions() {
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
    handleYCollisions() {
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
}
