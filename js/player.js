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

        this.bounds = new THREE.Box3();

        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    // Returns the integer coordinates of the block the player's feet are in
    getVoxelPos() {
        return {
            x: Math.floor(this.position.x),
            y: Math.floor(this.position.y),
            z: Math.floor(this.position.z)
        };
    }

    // Updates the player's bounding box based on their current position
    updateBounds() {
        // The player's position is at their feet. The bounding box is centered.
        const center = new THREE.Vector3(
            this.position.x,
            this.position.y + C.playerHeight / 2,
            this.position.z
        );
        const size = new THREE.Vector3(C.playerWidth, C.playerHeight, C.playerWidth);
        this.bounds.setFromCenterAndSize(center, size);
    }

    // Checks if there is a solid block directly beneath the player
    checkGrounded() {
        const playerFeet = this.bounds.min;
        const groundCheckY = Math.floor(playerFeet.y - 0.01);
        
        const x1 = Math.floor(playerFeet.x);
        const x2 = Math.floor(this.bounds.max.x);
        const z1 = Math.floor(playerFeet.z);
        const z2 = Math.floor(this.bounds.max.z);

        for (let x = x1; x <= x2; x++) {
            for (let z = z1; z <= z2; z++) {
                if (getBlock(x, groundCheckY, z) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // The main physics update function, called at a fixed interval
    physicsUpdate(deltaTime) {
        // 1. Get player input and determine desired velocity
        const inputVelocity = new THREE.Vector3();
        const moveSpeed = C.playerSpeed;
        
        if (this.controls.isLocked) {
            if (this.keys['KeyW']) inputVelocity.z = -moveSpeed;
            if (this.keys['KeyS']) inputVelocity.z = moveSpeed;
            if (this.keys['KeyA']) inputVelocity.x = -moveSpeed;
            if (this.keys['KeyD']) inputVelocity.x = moveSpeed;

            // Apply camera direction to the input velocity
            inputVelocity.applyQuaternion(this.camera.quaternion);
            this.velocity.x = inputVelocity.x;
            this.velocity.z = inputVelocity.z;
        }

        // 2. Handle ground check and gravity
        this.onGround = this.checkGrounded();
        if (!this.onGround) {
            this.velocity.y -= C.gravity * deltaTime;
        }

        // 3. Handle jumping
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = C.playerJumpHeight;
            this.onGround = false;
        }

        // 4. Apply velocity and handle collisions, one axis at a time
        this.position.x += this.velocity.x * deltaTime;
        this.updateBounds();
        this.handleXCollisions();

        this.position.z += this.velocity.z * deltaTime;
        this.updateBounds();
        this.handleZCollisions();

        this.position.y += this.velocity.y * deltaTime;
        this.updateBounds();
        this.handleYCollisions();
        
        // 5. Reset if fallen out of the world
        if (this.position.y < -20) {
            this.position.set(C.worldWidth / 2, C.worldHeight + 5, C.worldDepth / 2);
            this.velocity.set(0, 0, 0);
        }
    }

    // Updates the visual camera position, called every render frame
    updateCamera() {
        this.camera.position.copy(this.position);
        this.camera.position.y += C.playerEyeHeight;
    }

    // Helper function for collision handling
    handleXCollisions() {
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let y = y1; y <= y2; y++) {
            for (let z = z1; z <= z2; z++) {
                if (getBlock(x1, y, z) !== 0) { // Collision on the left
                    this.position.x = x1 + 1;
                    this.velocity.x = 0;
                    this.updateBounds();
                    return;
                }
                if (getBlock(x2, y, z) !== 0) { // Collision on the right
                    this.position.x = x2 - C.playerWidth;
                    this.velocity.x = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }
    
    handleZCollisions() {
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (getBlock(x, y, z1) !== 0) { // Collision on the "front"
                    this.position.z = z1 + 1;
                    this.velocity.z = 0;
                    this.updateBounds();
                    return;
                }
                if (getBlock(x, y, z2) !== 0) { // Collision on the "back"
                    this.position.z = z2 - C.playerWidth;
                    this.velocity.z = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }

    handleYCollisions() {
        const [x1, x2] = [Math.floor(this.bounds.min.x), Math.floor(this.bounds.max.x)];
        const [y1, y2] = [Math.floor(this.bounds.min.y), Math.floor(this.bounds.max.y)];
        const [z1, z2] = [Math.floor(this.bounds.min.z), Math.floor(this.bounds.max.z)];

        for (let x = x1; x <= x2; x++) {
            for (let z = z1; z <= z2; z++) {
                if (getBlock(x, y1, z) !== 0) { // Collision below (landing)
                    this.position.y = y1 + 1;
                    this.velocity.y = 0;
                    this.onGround = true;
                    this.updateBounds();
                    return;
                }
                if (getBlock(x, y2, z) !== 0) { // Collision above (hitting ceiling)
                    this.position.y = y2 - C.playerHeight;
                    this.velocity.y = 0;
                    this.updateBounds();
                    return;
                }
            }
        }
    }
}
