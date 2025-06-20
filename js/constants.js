// World Generation
export const worldWidth = 64;
export const worldDepth = 64;
export const worldHeight = 32;
export const noiseScale = 20;

// Player
export const playerSpeed = 5;
export const playerJumpHeight = 8;
export const playerWidth = 0.6; // Slightly wider to avoid squeezing through corners
export const playerHeight = 1.8;
export const playerEyeHeight = 1.62;

// Inventory
export const hotbarBlocks = [1, 2, 3, 4, 5]; // IDs from blocks.js: grass, dirt, stone, wood, leaves

// Physics
export const gravity = 32;
export const fixedUpdateInterval = 1 / 60; // 60 times per second
