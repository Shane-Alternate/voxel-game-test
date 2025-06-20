import * as THREE from 'three';
import { generateWorld } from './world.js';
import { WorldRenderer } from './worldRenderer.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import * as C from './constants.js';
import { blockTypes } from './blocks.js'; // Import blockTypes for UI

// --- BASIC SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 0.5);
scene.add(directionalLight);

// --- WORLD ---
generateWorld();
const worldRenderer = new WorldRenderer(scene);
worldRenderer.update();

// --- PLAYER & INTERACTION ---
const player = new Player(camera, document.body);
player.position.set(C.worldWidth / 2, C.worldHeight, C.worldDepth / 2);
const interaction = new Interaction(camera, scene, worldRenderer, player);

// --- UI & CONTROLS ---
const hotbarElement = document.getElementById('hotbar');

function updateHotbarUI() {
    hotbarElement.innerHTML = ''; // Clear previous slots
    player.hotbar.forEach((blockId, index) => {
        const slot = document.createElement('div');
        slot.classList.add('hotbar-slot');
        if (index === player.selectedSlot) {
            slot.classList.add('selected');
        }
        
        // Get the texture from the block definition
        const blockType = blockTypes[blockId];
        if (blockType && blockType.material.map) {
            const color = blockType.material.map.image.getContext('2d').fillStyle;
            slot.style.backgroundColor = color;
        }
        hotbarElement.appendChild(slot);
    });
}

const instructions = document.getElementById('instructions');
const startButton = document.getElementById('startButton');
startButton.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => { instructions.style.display = 'none'; hotbarElement.style.display = 'flex'; });
player.controls.addEventListener('unlock', () => { instructions.style.display = 'block'; hotbarElement.style.display = 'none'; });

window.addEventListener('mousedown', (e) => interaction.handleMouseClick(e));
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hotbar selection listener
window.addEventListener('wheel', (e) => {
    if (!player.controls.isLocked) return;
    const delta = Math.sign(e.deltaY);
    player.changeSlot(delta);
    updateHotbarUI();
});

// --- GAME LOOP ---
const clock = new THREE.Clock();
let accumulator = 0;

function animate() {
    requestAnimationFrame(animate);

    accumulator += clock.getDelta();
    while (accumulator >= C.fixedUpdateInterval) {
        if(player.controls.isLocked) {
           player.physicsUpdate(C.fixedUpdateInterval);
        }
        accumulator -= C.fixedUpdateInterval;
    }
    
    player.updateCamera();
    interaction.update();
    renderer.render(scene, camera);
}

// Initial UI setup
updateHotbarUI();
hotbarElement.style.display = 'none'; // Hide until game starts
animate();
