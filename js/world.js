import { createNoise2D } from 'simplex-noise';
import * as C from './constants.js';

export const world = new Uint8Array(C.worldWidth * C.worldDepth * C.worldHeight);

export function getBlock(x, y, z) {
    if (x < 0 || x >= C.worldWidth || y < 0 || y >= C.worldHeight || z < 0 || z >= C.worldDepth) {
        return 0; // Air
    }
    return world[y * C.worldWidth * C.worldDepth + z * C.worldWidth + x];
}

export function setBlock(x, y, z, type) {
    if (x < 0 || x >= C.worldWidth || y < 0 || y >= C.worldHeight || z < 0 || z >= C.worldDepth) {
        return;
    }
    world[y * C.worldWidth * C.worldDepth + z * C.worldWidth + x] = type;
}

export function generateWorld() {
    console.log("Generating world...");
    const noise2D = createNoise2D();

    for (let x = 0; x < C.worldWidth; x++) {
        for (let z = 0; z < C.worldDepth; z++) {
            const noiseVal = noise2D(x / C.noiseScale, z / C.noiseScale);
            const height = Math.round((noiseVal + 1) / 2 * (C.worldHeight / 2)) + Math.floor(C.worldHeight / 4);

            for (let y = 0; y < height; y++) {
                if (y === height - 1) {
                    setBlock(x, y, z, 1); // Grass
                } else if (y > height - 5) {
                    setBlock(x, y, z, 2); // Dirt
                } else {
                    setBlock(x, y, z, 3); // Stone
                }
            }
        }
    }
    console.log("World generation complete.");
}
