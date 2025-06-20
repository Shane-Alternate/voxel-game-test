import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import * as C from './constants.js';
import { blockTypes } from './blocks.js';

// --- BASIC SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

// --- CHUNK MANAGEMENT ---
const chunks = new Map();
let lastPlayerChunkId = '';

function updateChunks() {
    const { chunkX, chunkZ } = player.getChunkCoords();
    const playerChunkId = `${chunkX},${chunkZ}`;

    // Only update if player has moved to a new chunk
    if (playerChunkId === lastPlayerChunkId) return;
    lastPlayerChunkId = playerChunkId;

    const chunksToRemove = new Set(chunks.keys());

    // Loop through all chunks that should be visible
    for (let x = chunkX - C.viewDistance; x <= chunkX + C.viewDistance; x++) {
        for (let z = chunkZ - C.viewDistance; z <= chunkZ + C.viewDistance; z++) {
            const id = `${x},${z}`;
            chunksToRemove.delete(id); // This chunk is in range, so don't remove it

            // If the chunk doesn't exist, create it
            if (!chunks.has(id)) {
                const chunk = new Chunk(scene, x, z);
                
                // 1. Fill the chunk data array without updating the mesh
                chunk.generate();
                // 2. Build the mesh ONCE after all data is ready to prevent freezing
                chunk.updateMesh();
                
                chunks.set(id, chunk);
            }
        }
    }

    // Unload any chunks that are now out of view distance
    for (const id of chunksToRemove) {
        chunks.get(id)?.dispose();
        chunks.delete(id);
    }
}

// --- PLAYER & INTERACTION ---
const player = new Player(camera, document.body);
player.position.set(0, C.worldHeight + 5, 0);
const interaction = new Interaction(camera, scene, player, chunks);

// --- UI & CONTROLS ---
const uiContainer = document.getElementById('ui-container');
const hotbarElement = document.getElementById('hotbar');
const popupElement = document.getElementById('block-popup');
let popupTimeout;

function updateHotbarUI() {
    hotbarElement.innerHTML = '';
    player.hotbar.forEach((blockId, index) => {
        const slot = document.createElement('div');
        slot.classList.add('hotbar-slot');
        if (index === player.selectedSlot) {
            slot.classList.add('selected');
        }
        const blockType = blockTypes[blockId];
        if (blockType && blockType.material.map) {
            const color = blockType.material.map.image.getContext('2d').fillStyle;
            slot.style.backgroundColor = color;
        }
        hotbarElement.appendChild(slot);
    });
}

function showBlockPopup() {
    clearTimeout(popupTimeout);
    const blockId = player.getHotbarSelection();
    const blockName = blockTypes[blockId].name;
    popupElement.textContent = blockName.charAt(0).toUpperCase() + blockName.slice(1);
    popupElement.classList.add('show');
    popupTimeout = setTimeout(() => {
        popupElement.classList.remove('show');
    }, 1500);
}

const instructions = document.getElementById('instructions');
const startButton = document.getElementById('startButton');
startButton.addEventListener('click', () => {
    player.controls.lock();
});
player.controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    uiContainer.style.display = 'flex';
    updateHotbarUI();
    showBlockPopup();
});
player.controls.addEventListener('unlock', () => {
    instructions.style.display = 'block';
    uiContainer.style.display = 'none';
});

window.addEventListener('mousedown', (e) => interaction.handleMouseClick(e));
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
    if (!player.controls.isLocked) return;
    const key = parseInt(e.key);
    if (key >= 1 && key <= player.hotbar.length) {
        player.selectSlot(key - 1);
        updateHotbarUI();
        showBlockPopup();
    }
});

// --- GAME LOOP ---
const clock = new THREE.Clock();
let accumulator = 0;

function animate() {
    requestAnimationFrame(animate);

    // Fixed-step physics loop
    accumulator += clock.getDelta();
    while (accumulator >= C.fixedUpdateInterval) {
        if(player.controls.isLocked) {
           player.physicsUpdate(C.fixedUpdateInterval);
        }
        accumulator -= C.fixedUpdateInterval;
    }
    
    // Render loop
    if(player.controls.isLocked) {
        updateChunks();
        player.updateCamera();
        interaction.update();
    }
    renderer.render(scene, camera);
}

// --- INITIALIZATION ---
updateChunks();
uiContainer.style.display = 'none';
animate();
