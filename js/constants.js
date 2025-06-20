// World Generation
export const worldHeight = 32;
export const noiseScale = 30; // Slightly larger scale for more interesting terrain

// --- NEW CHUNK CONSTANTS ---
export const chunkSize = 16;
export const viewDistance = 4; // Render a 9x9 grid of chunks (4 in each direction + center)

// Player
export const playerWidth = 0.6;
export const playerHeight = 1.8;
export const playerEyeHeight = 1.62;
export const playerReach = 5;

// Inventory
export const hotbarBlocks = [1, 2, 3, 4, 5];

// Physics (remain the same)
export const walkSpeed = 4.317;
export const sprintSpeed = 5.612;
export const horizontalAcceleration = 30;
export const groundDrag = 8.0;
export const airDrag = 2.0;
export const jumpInitialVelocity = 8.4;
export const gravity = 32;
export const verticalDrag = 0.6676;

// Game Loop
export const fixedUpdateInterval = 1 / 60;
