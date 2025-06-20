import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import * as C from './constants.js';
import { blockTypes } from './blocks.js';

const noise2D = createNoise2D();

// A map to hold all chunk data, accessible globally within this module
const chunks = new Map();

// Helper to get a block's type from any chunk, using world coordinates
export function getBlock(x, y, z) {
    if (y < 0 || y >= C.worldHeight) return 0; // Air

    const chunkX = Math.floor(x / C.chunkSize);
    const chunkZ = Math.floor(z / C.chunkSize);
    const chunkId = `${chunkX},${chunkZ}`;
    
    const chunk = chunks.get(chunkId);
    if (!chunk) return 0; // Unloaded chunk is considered air

    const localX = THREE.MathUtils.euclideanModulo(x, C.chunkSize);
    const localZ = THREE.MathUtils.euclideanModulo(z, C.chunkSize);

    return chunk.getBlock(localX, y, localZ);
}

// Helper to set a block's type, finding the correct chunk first
export function setBlock(x, y, z, type) {
    if (y < 0 || y >= C.worldHeight) return;

    const chunkX = Math.floor(x / C.chunkSize);
    const chunkZ = Math.floor(z / C.chunkSize);
    const chunkId = `${chunkX},${chunkZ}`;

    const chunk = chunks.get(chunkId);
    if (!chunk) return; // Cannot set block in unloaded chunk

    const localX = THREE.MathUtils.euclideanModulo(x, C.chunkSize);
    const localZ = THREE.MathUtils.euclideanModulo(z, C.chunkSize);
    
    chunk.setBlock(localX, y, localZ, type);

    // If the block is on a chunk boundary, the neighbor chunk also needs to update its mesh
    if (localX === 0) chunks.get(`${chunkX - 1},${chunkZ}`)?.updateMesh();
    if (localX === C.chunkSize - 1) chunks.get(`${chunkX + 1},${chunkZ}`)?.updateMesh();
    if (localZ === 0) chunks.get(`${chunkX},${chunkZ - 1}`)?.updateMesh();
    if (localZ === C.chunkSize - 1) chunks.get(`${chunkX},${chunkZ + 1}`)?.updateMesh();
}

export class Chunk {
    constructor(scene, chunkX, chunkZ) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.id = `${chunkX},${chunkZ}`;
        
        // Use a single material for all blocks in the chunk
        this.material = new THREE.MeshLambertMaterial({ 
            map: blockTypes[1].material.map, // Use any texture initially, doesn't matter
            vertexColors: true, // This is crucial for AO!
            side: THREE.FrontSide
        });

        this.mesh = null;
        this.data = new Uint8Array(C.chunkSize * C.chunkSize * C.worldHeight);
        
        chunks.set(this.id, this); // Register this chunk
    }

    // Generate terrain data for this chunk
    generate() {
        for (let x = 0; x < C.chunkSize; x++) {
            for (let z = 0; z < C.chunkSize; z++) {
                const worldX = this.chunkX * C.chunkSize + x;
                const worldZ = this.chunkZ * C.chunkSize + z;

                const noiseVal = noise2D(worldX / C.noiseScale, worldZ / C.noiseScale);
                const height = Math.round((noiseVal + 1) / 2 * (C.worldHeight / 2)) + Math.floor(C.worldHeight / 4);

                for (let y = 0; y < height; y++) {
                    let blockType = 3; // Stone
                    if (y === height - 1) blockType = 1; // Grass
                    else if (y > height - 5) blockType = 2; // Dirt
                    this.setBlock(x, y, z, blockType);
                }
            }
        }
    }

    // Get a block from this chunk's local data
    getBlock(x, y, z) {
        if (x < 0 || x >= C.chunkSize || y < 0 || y >= C.worldHeight || z < 0 || z >= C.chunkSize) return 0;
        const index = y * C.chunkSize * C.chunkSize + z * C.chunkSize + x;
        return this.data[index];
    }
    
    // Set a block in this chunk's local data and update the mesh
    setBlock(x, y, z, type) {
        const index = y * C.chunkSize * C.chunkSize + z * C.chunkSize + x;
        this.data[index] = type;
        this.updateMesh();
    }

    // The core function to build this chunk's mesh from scratch
    updateMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        const positions = [];
        const normals = [];
        const uvs = [];
        const colors = []; // For Ambient Occlusion

        const aoValues = [0.5, 0.7, 0.8, 1.0]; // Darkness levels for AO

        for (let x = 0; x < C.chunkSize; x++) {
            for (let y = 0; y < C.worldHeight; y++) {
                for (let z = 0; z < C.chunkSize; z++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === 0) continue; // Skip air

                    const worldX = this.chunkX * C.chunkSize + x;
                    const worldY = y;
                    const worldZ = this.chunkZ * C.chunkSize + z;
                    
                    // Check all 6 faces of the block
                    for (const face of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
                        const neighbor = this.getNeighbor(x, y, z, face);

                        if (neighbor === 0) { // If neighbor is air, draw this face
                            const { vertices, normal, uv } = this.getFaceData(face);
                            const texture = blockTypes[blockType].material.map;
                            
                            for (let i = 0; i < 4; i++) {
                                const vert = vertices[i];
                                positions.push(vert.x + worldX, vert.y + worldY, vert.z + worldZ);
                                normals.push(...normal);
                                uvs.push(uv[i * 2], uv[i * 2 + 1]);

                                // Ambient Occlusion Calculation
                                const [ao, aoVal] = this.calculateAO(x, y, z, face, i);
                                const brightness = aoValues[ao];
                                colors.push(brightness, brightness, brightness);
                            }
                        }
                    }
                }
            }
        }

        if (positions.length === 0) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
    }
    
    // Helper to get neighbor block, checks adjacent chunks if needed
    getNeighbor(x, y, z, face) {
        const [dx, dy, dz] = {
            px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1]
        }[face];
        return getBlock(this.chunkX * C.chunkSize + x + dx, y + dy, this.chunkZ * C.chunkSize + z + dz);
    }
    
    // --- AMBIENT OCCLUSION CALCULATION ---
    calculateAO(x, y, z, face, vertexIndex) {
        const wx = this.chunkX * C.chunkSize + x;
        const wy = y;
        const wz = this.chunkZ * C.chunkSize + z;

        const aoDirs = this.getAODirections(face, vertexIndex);
        const side1 = getBlock(wx + aoDirs[0][0], wy + aoDirs[0][1], wz + aoDirs[0][2]) !== 0;
        const side2 = getBlock(wx + aoDirs[1][0], wy + aoDirs[1][1], wz + aoDirs[1][2]) !== 0;
        
        if (side1 && side2) return [0, 'Both sides blocked']; // Darkest
        
        const corner = getBlock(wx + aoDirs[2][0], wy + aoDirs[2][1], wz + aoDirs[2][2]) !== 0;
        
        const aoValue = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
        return [3 - aoValue, 'Calculation']; // 3 is brightest, 0 is darkest
    }
    
    // Returns the 3 neighbor block directions to check for a given face vertex
    getAODirections(face, vertex) {
        // Maps face and vertex index (0-3) to the 3 directions to check for AO
        // [side1, side2, corner]
        // This is complex and depends on how you define your quad vertices.
        // A precomputed lookup table is the best way.
        const px = [[[0,1,0],[0,0,-1],[0,1,-1]],[[0,-1,0],[0,0,-1],[0,-1,-1]],[[0,-1,0],[0,0,1],[0,-1,1]],[[0,1,0],[0,0,1],[0,1,1]]];
        const nx = [[[0,1,0],[0,0,1],[0,1,1]],[[0,-1,0],[0,0,1],[0,-1,1]],[[0,-1,0],[0,0,-1],[0,-1,-1]],[[0,1,0],[0,0,-1],[0,1,-1]]];
        const py = [[[0,0,-1],[-1,0,0],[-1,0,-1]],[[0,0,-1],[1,0,0],[1,0,-1]],[[0,0,1],[1,0,0],[1,0,1]],[[0,0,1],[-1,0,0],[-1,0,1]]];
        const ny = [[[0,0,1],[-1,0,0],[-1,0,1]],[[0,0,1],[1,0,0],[1,0,1]],[[0,0,-1],[1,0,0],[1,0,-1]],[[0,0,-1],[-1,0,0],[-1,0,-1]]];
        const pz = [[[0,1,0],[-1,0,0],[-1,1,0]],[[0,-1,0],[-1,0,0],[-1,-1,0]],[[0,-1,0],[1,0,0],[1,-1,0]],[[0,1,0],[1,0,0],[1,1,0]]];
        const nz = [[[0,1,0],[1,0,0],[1,1,0]],[[0,-1,0],[1,0,0],[1,-1,0]],[[0,-1,0],[-1,0,0],[-1,-1,0]],[[0,1,0],[-1,0,0],[-1,1,0]]];
        return {px,nx,py,ny,pz,nz}[face][vertex];
    }
    
    // Pre-computed vertex data for each face of a cube
    getFaceData(face) {
        // Defines vertices, normal, and UVs for a single quad
        const data = {
            px: { vertices: [{x:1,y:1,z:0},{x:1,y:0,z:0},{x:1,y:0,z:1},{x:1,y:1,z:1}], normal: [1,0,0], uv: [0,1, 0,0, 1,0, 1,1] },
            nx: { vertices: [{x:0,y:1,z:1},{x:0,y:0,z:1},{x:0,y:0,z:0},{x:0,y:1,z:0}], normal: [-1,0,0], uv: [0,1, 0,0, 1,0, 1,1] },
            py: { vertices: [{x:0,y:1,z:0},{x:1,y:1,z:0},{x:1,y:1,z:1},{x:0,y:1,z:1}], normal: [0,1,0], uv: [0,0, 1,0, 1,1, 0,1] },
            ny: { vertices: [{x:0,y:0,z:1},{x:1,y:0,z:1},{x:1,y:0,z:0},{x:0,y:0,z:0}], normal: [0,-1,0], uv: [0,1, 1,1, 1,0, 0,0] },
            pz: { vertices: [{x:0,y:1,z:1},{x:1,y:1,z:1},{x:1,y:0,z:1},{x:0,y:0,z:1}], normal: [0,0,1], uv: [0,1, 1,1, 1,0, 0,0] },
            nz: { vertices: [{x:1,y:1,z:0},{x:0,y:1,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}], normal: [0,0,-1], uv: [0,1, 1,1, 1,0, 0,0] }
        };
        return data[face];
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }
        chunks.delete(this.id);
    }
}
