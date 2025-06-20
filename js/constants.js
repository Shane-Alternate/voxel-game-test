// World Generation
export const worldWidth = 64;
export const worldDepth = 64;
export const worldHeight = 32;
export const noiseScale = 20;

// Player
export const playerWidth = 0.6;
export const playerHeight = 1.8;
export const playerEyeHeight = 1.62;
export const playerReach = 5; // Realistic block reach distance

// Inventory
export const hotbarBlocks = [1, 2, 3, 4, 5];

// --- REFINED MINECRAFT PHYSICS CONSTANTS ---
const ticksPerSecond = 20;

// Horizontal Movement
export const walkSpeed = 4.317; // m/s
export const sprintSpeed = 5.612; // m/s
export const horizontalAcceleration = 30; // How quickly the player reaches top speed
export const groundDrag = 8.0; // Damping factor when on the ground
export const airDrag = 2.0;    // Damping factor when in the air

// Vertical Movement
const jumpVelocityPerTick = 0.42;
const gravityPerTick = 0.08;
const dragPerTick = 0.98;

export const jumpInitialVelocity = jumpVelocityPerTick * ticksPerSecond;
export const gravity = gravityPerTick * ticksPerSecond * ticksPerSecond;
export const verticalDrag = Math.pow(dragPerTick, ticksPerSecond);

// Game Loop
export const fixedUpdateInterval = 1 / 60;
