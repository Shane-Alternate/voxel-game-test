import * as THREE from 'three';
import { generateWorld } from './world.js';
import { WorldRenderer } from './worldRenderer.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import * as C from './constants.js';

// --- BASIC SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(C.worldWidth / 2, C.worldHeight + 5, C.worldDepth / 2);

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
const interaction = new Interaction(camera, scene, worldRenderer, player);

// --- UI & CONTROLS ---
const instructions = document.getElementById('instructions');
const startButton = document.getElementById('startButton');
startButton.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => instructions.style.display = 'none');
player.controls.addEventListener('unlock', () => instructions.style.display = 'block');

window.addEventListener('mousedown', (e) => interaction.handleMouseClick(e));
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- GAME LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    player.update(deltaTime);
    interaction.update();

    renderer.render(scene, camera);
}

animate();
