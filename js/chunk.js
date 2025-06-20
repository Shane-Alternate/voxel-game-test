import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import * as C from './constants.js';
import { blockTypes } from './blocks.js';

const noise2D = createNoise2D();
const chunks = new Map();

export function getBlock(x, y, z) {
    if (y < 0 || y >= C.worldHeight) return 0;
    const chunkX = Math.floor(x / C.chunkSize);
    const chunkZ = Math.floor(z / C.chunkSize);
    const chunkId = `${chunkX},${chunkZ}`;
    const chunk = chunks.get(chunkId);
    if (!chunk) return 0;
    const localX = THREE.MathUtils.euclideanModulo(x, C.chunkSize);
    const localZ = THREE.MathUtils.euclideanModulo(z, C.chunkSize);
    return chunk.getBlock(localX, y, localZ);
}

export function setBlock(x, y, z, type) {
    if (y < 0 || y >= C.worldHeight) return;
    const chunkX = Math.floor(x / C.chunkSize);
    const chunkZ = Math.floor(z / C.chunkSize);
    const chunkId = `${chunkX},${chunkZ}`;
    const chunk = chunks.get(chunkId);
    if (!chunk) return;
    const localX = THREE.MathUtils.euclideanModulo(x, C.chunkSize);
    const localZ = THREE.MathUtils.euclideanModulo(z, C.chunkSize);
    chunk.setBlock(localX, y, localZ, type);
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
        this.mesh = null;
        this.data = new Uint8Array(C.chunkSize * C.chunkSize * C.worldHeight);
        chunks.set(this.id, this);
    }

    generate() {
        for (let x = 0; x < C.chunkSize; x++) {
            for (let z = 0; z < C.chunkSize; z++) {
                const worldX = this.chunkX * C.chunkSize + x;
                const worldZ = this.chunkZ * C.chunkSize + z;
                const noiseVal = noise2D(worldX / C.noiseScale, worldZ / C.noiseScale);
                const height = Math.round((noiseVal + 1) / 2 * (C.worldHeight * 0.5)) + Math.floor(C.worldHeight * 0.25);
                for (let y = 0; y < height; y++) {
                    let blockType = 3;
                    if (y === height - 1) blockType = 1;
                    else if (y > height - 5) blockType = 2;
                    this.setBlock(x, y, z, blockType, false);
                }
            }
        }
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= C.chunkSize || y < 0 || y >= C.worldHeight || z < 0 || z >= C.chunkSize) return 0;
        return this.data[y * C.chunkSize * C.chunkSize + z * C.chunkSize + x];
    }

    setBlock(x, y, z, type, update = true) {
        const index = y * C.chunkSize * C.chunkSize + z * C.chunkSize + x;
        if (index < 0 || index >= this.data.length) return;
        this.data[index] = type;
        if (update) this.updateMesh();
    }

    updateMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(material => material.dispose());
            }
            this.mesh = null;
        }

        const geometryData = {};
        const aoValues = [0.5, 0.7, 0.85, 1.0];

        for (let y = 0; y < C.worldHeight; y++) {
            for (let z = 0; z < C.chunkSize; z++) {
                for (let x = 0; x < C.chunkSize; x++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === 0) continue;

                    if (!geometryData[blockType]) {
                        geometryData[blockType] = { positions:[], normals:[], uvs:[], colors:[], indices:[], vertexCount:0 };
                    }
                    const data = geometryData[blockType];

                    for (const { dir, corners, uv } of faces) {
                        const worldX = this.chunkX * C.chunkSize + x;
                        const worldY = y;
                        const worldZ = this.chunkZ * C.chunkSize + z;
                        const neighbor = getBlock(worldX + dir[0], worldY + dir[1], worldZ + dir[2]);
                        
                        if (neighbor === 0) {
                            for (let i = 0; i < 4; i++) {
                                const corner = corners[i];
                                data.positions.push(worldX + corner.pos[0], worldY + corner.pos[1], worldZ + corner.pos[2]);
                                data.normals.push(dir[0], dir[1], dir[2]);
                                data.uvs.push(uv[i * 2], uv[i * 2 + 1]);
                                
                                const ao = this.calculateAO(worldX, worldY, worldZ, corner.ao);
                                const brightness = aoValues[ao];
                                data.colors.push(brightness, brightness, brightness);
                            }
                            
                            const vCount = data.vertexCount;
                            data.indices.push(vCount, vCount + 1, vCount + 2, vCount, vCount + 2, vCount + 3);
                            data.vertexCount += 4;
                        }
                    }
                }
            }
        }
        
        // *** FIX: Correctly combine geometries into one mesh with material groups ***
        
        const finalPositions = [], finalNormals = [], finalUvs = [], finalColors = [], finalIndices = [];
        const materials = [];
        let overallVertexCount = 0;
        let overallIndexCount = 0;

        // Loop through each block type that has geometry
        for (const blockType in geometryData) {
            const data = geometryData[blockType];
            if (data.vertexCount === 0) continue;

            // Append this block type's geometry data to the final arrays
            finalPositions.push(...data.positions);
            finalNormals.push(...data.normals);
            finalUvs.push(...data.uvs);
            finalColors.push(...data.colors);
            
            // Remap indices by adding the current total vertex count
            for (const index of data.indices) {
                finalIndices.push(index + overallVertexCount);
            }
            
            // Create and add the material for this group
            const material = blockTypes[blockType].material.clone();
            material.vertexColors = true;
            const materialIndex = materials.push(material) - 1;

            // Create a material group for this section of the geometry
            const geometry = new THREE.BufferGeometry(); // Temporary geometry for addGroup
            geometry.addGroup(overallIndexCount, data.indices.length, materialIndex);

            // Update offsets for the next block type
            overallVertexCount += data.vertexCount;
            overallIndexCount += data.indices.length;
        }

        // If there's no geometry to render at all, exit
        if (overallVertexCount === 0) return;

        // Create a single, final BufferGeometry from the combined arrays
        const finalGeometry = new THREE.BufferGeometry();
        finalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3));
        finalGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNormals, 3));
        finalGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2));
        finalGeometry.setAttribute('color', new THREE.Float32BufferAttribute(finalColors, 3));
        finalGeometry.setIndex(finalIndices);
        
        // Re-apply the material groups to the final geometry
        overallIndexCount = 0;
        let materialIndex = 0;
        for (const blockType in geometryData) {
            const data = geometryData[blockType];
            if (data.vertexCount === 0) continue;
            finalGeometry.addGroup(overallIndexCount, data.indices.length, materialIndex++);
            overallIndexCount += data.indices.length;
        }

        this.mesh = new THREE.Mesh(finalGeometry, materials);
        this.scene.add(this.mesh);
    }

    calculateAO(x, y, z, aoDirs) {
        const side1 = getBlock(x + aoDirs[0][0], y + aoDirs[0][1], z + aoDirs[0][2]) !== 0;
        const side2 = getBlock(x + aoDirs[1][0], y + aoDirs[1][1], z + aoDirs[1][2]) !== 0;
        if (side1 && side2) return 0;
        const corner = getBlock(x + aoDirs[2][0], y + aoDirs[2][1], z + aoDirs[2][2]) !== 0;
        return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
    }
    
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        chunks.delete(this.id);
    }
}

// Pre-computed face data structure
const faces = [{dir:[1,0,0],corners:[{pos:[1,0,0],ao:[[0,-1,0],[0,0,-1],[0,-1,-1]]},{pos:[1,1,0],ao:[[0,1,0],[0,0,-1],[0,1,-1]]},{pos:[1,1,1],ao:[[0,1,0],[0,0,1],[0,1,1]]},{pos:[1,0,1],ao:[[0,-1,0],[0,0,1],[0,-1,1]]}],uv:[0,0,0,1,1,1,1,0]},{dir:[-1,0,0],corners:[{pos:[0,0,1],ao:[[0,-1,0],[0,0,1],[0,-1,1]]},{pos:[0,1,1],ao:[[0,1,0],[0,0,1],[0,1,1]]},{pos:[0,1,0],ao:[[0,1,0],[0,0,-1],[0,1,-1]]},{pos:[0,0,0],ao:[[0,-1,0],[0,0,-1],[0,-1,-1]]}],uv:[0,0,0,1,1,1,1,0]},{dir:[0,1,0],corners:[{pos:[0,1,0],ao:[[-1,0,0],[0,0,-1],[-1,0,-1]]},{pos:[0,1,1],ao:[[-1,0,0],[0,0,1],[-1,0,1]]},{pos:[1,1,1],ao:[[1,0,0],[0,0,1],[1,0,1]]},{pos:[1,1,0],ao:[[1,0,0],[0,0,-1],[1,0,-1]]}],uv:[0,0,0,1,1,1,1,0]},{dir:[0,-1,0],corners:[{pos:[0,0,1],ao:[[-1,0,0],[0,0,1],[-1,0,1]]},{pos:[0,0,0],ao:[[-1,0,0],[0,0,-1],[-1,0,-1]]},{pos:[1,0,0],ao:[[1,0,0],[0,0,-1],[1,0,-1]]},{pos:[1,0,1],ao:[[1,0,0],[0,0,1],[1,0,1]]}],uv:[0,0,0,1,1,1,1,0]},{dir:[0,0,1],corners:[{pos:[0,0,1],ao:[[-1,0,0],[0,-1,0],[-1,-1,0]]},{pos:[0,1,1],ao:[[-1,0,0],[0,1,0],[-1,1,0]]},{pos:[1,1,1],ao:[[1,0,0],[0,1,0],[1,1,0]]},{pos:[1,0,1],ao:[[1,0,0],[0,-1,0],[1,-1,0]]}],uv:[0,0,0,1,1,1,1,0]},{dir:[0,0,-1],corners:[{pos:[1,0,0],ao:[[1,0,0],[0,-1,0],[1,-1,0]]},{pos:[1,1,0],ao:[[1,0,0],[0,1,0],[1,1,0]]},{pos:[0,1,0],ao:[[-1,0,0],[0,1,0],[-1,1,0]]},{pos:[0,0,0],ao:[[-1,0,0],[0,-1,0],[-1,-1,0]]}],uv:[0,0,0,1,1,1,1,0]}];
