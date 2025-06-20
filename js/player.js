import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as C from './constants.js';
import { getBlock } from './world.js';

export class Player {
    constructor(camera, domElement) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.keys = {};

        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    getVoxelPos() {
        return {
            x: Math.floor(this.camera.position.x),
            y: Math.floor(this.camera.position.y),
            z: Math.floor(this.camera.position.z)
        };
    }

    checkCollision() {
        const pos = this.camera.position;
        const vel = this.velocity;
        const pWidth = C.playerWidth;
        const pHeight = C.playerHeight;

        // Check Y-axis (gravity/jump)
        if (vel.y < 0) {
            const feetY = pos.y - pHeight / 2;
            const nextFeetY = feetY + vel.y * (1/60); // approx deltaTime
            const groundBlockY = Math.floor(nextFeetY);
            
            const feetX1 = Math.floor(pos.x - pWidth / 2);
            const feetX2 = Math.floor(pos.x + pWidth / 2);
            const feetZ1 = Math.floor(pos.z - pWidth / 2);
            const feetZ2 = Math.floor(pos.z + pWidth / 2);

            if ((getBlock(feetX1, groundBlockY, feetZ1) !== 0) || (getBlock(feetX2, groundBlockY, feetZ1) !== 0) ||
                (getBlock(feetX1, groundBlockY, feetZ2) !== 0) || (getBlock(feetX2, groundBlockY, feetZ2) !== 0)) {
               
               vel.y = 0;
               pos.y = groundBlockY + 1 + pHeight / 2;
               this.onGround = true;
            }
        }
    }

    update(deltaTime) {
        if (!this.controls.isLocked) return;

        // Movement
        const moveSpeed = C.playerSpeed * deltaTime;
        if (this.keys['KeyW']) this.controls.moveForward(moveSpeed);
        if (this.keys['KeyS']) this.controls.moveForward(-moveSpeed);
        if (this.keys['KeyA']) this.controls.moveRight(-moveSpeed);
        if (this.keys['KeyD']) this.controls.moveRight(moveSpeed);

        // Jumping
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = C.playerJumpHeight;
            this.onGround = false;
        }
        
        // Apply gravity
        if (!this.onGround) {
            this.velocity.y += C.gravity * deltaTime;
        }

        this.checkCollision();
        this.camera.position.y += this.velocity.y * deltaTime;

        // Simple world bounds to prevent falling forever
        if (this.camera.position.y < -20) {
            this.camera.position.set(C.worldWidth / 2, 35, C.worldDepth / 2);
            this.velocity.set(0, 0, 0);
        }
    }
}
