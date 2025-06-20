// World Generation
export const worldWidth = 64;
export const worldDepth = 64;
export const worldHeight = 32;
export const noiseScale = 20;

// Player
export const playerWidth = 0.6;
export const playerHeight = 1.8;
export const playerEyeHeight = 1.62;

// Inventory
export const hotbarBlocks = [1, 2, 3, 4, 5]; // IDs from blocks.js

// --- MINECRAFT PHYSICS CONSTANTS (from your document) ---
const ticksPerSecond = 20;

// Horizontal Movement (converted from m/tick to m/s)
const walkAccelerationPerTick = 0.098;
const groundFriction = 0.546;
export const walkSpeed = (walkAccelerationPerTick / (1 - groundFriction)) * ticksPerSecond; // ~4.317 m/s
export const sprintSpeed = walkSpeed * 1.3; // ~5.612 m/s
export const horizontalAcceleration = 25; // A value that feels good for reaching top speed
export const airControl = 0.02; // A multiplier for how much you can move in the air

// Vertical Movement (converted for a per-second simulation)
const jumpVelocityPerTick = 0.42;
const gravityPerTick = 0.08;
const dragPerTick = 0.98;

export const jumpInitialVelocity = jumpVelocityPerTick * ticksPerSecond; // 8.4 m/s
export const gravity = gravityPerTick * ticksPerSecond * ticksPerSecond; // ~32 m/s^2
// To apply a per-tick multiplier over a second, we raise it to the power of ticksPerSecond
export const verticalDrag = Math.pow(dragPerTick, ticksPerSecond); // ~0.6676 drag factor per second

// Game Loop
export const fixedUpdateInterval = 1 / 60; // 60 times per second
