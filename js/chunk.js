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
                    let blockType = 3; // Stone
                    if (y === height - 1) blockType = 1; // Grass
                    else if (y > height - 5) blockType = 2; // Dirt
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
            // Also dispose of materials if they are arrays
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(material => material.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }

        // *** FIX: Use an object to group geometry data by block type (material) ***
        const geometryData = {};

        const aoValues = [0.5, 0.7, 0.85, 1.0];

        for (let x = 0; x < C.chunkSize; x++) {
            for (let y = 0; y < C.worldHeight; y++) {
                for (let z = 0; z < C.chunkSize; z++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === 0) continue;

                    // Initialize geometry arrays for this block type if they don't exist
                    if (!geometryData[blockType]) {
                        geometryData[blockType] = { positions: [], normals: [], uvs: [], colors: [], indices: [], vertexCount: 0 };
                    }
                    const data = geometryData[blockType];

                    for (const face of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
                        const neighbor = this.getNeighbor(x, y, z, face);
                        if (neighbor === 0) {
                            const { vertices, normal, uv } = this.getFaceData(face);
                            const worldX = this.chunkX * C.chunkSize + x;
                            const worldY = y;
                            const worldZ = this.chunkZ * C.chunkSize + z;

                            for (let i = 0; i < 4; i++) {
                                const vert = vertices[i];
                                data.positions.push(vert.x + worldX, vert.y + worldY, vert.z + worldZ);
                                data.normals.push(...normal);
                                data.uvs.push(uv[i * 2], uv[i * 2 + 1]);
                                const [ao] = this.calculateAO(x, y, z, face, i);
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
        
        // If there's nothing to render, exit
        if (Object.keys(geometryData).length === 0) return;

        // *** FIX: Combine all geometry data into one BufferGeometry and use material groups ***
        const finalGeometry = new THREE.BufferGeometry();
        const finalPositions = [];
        const finalNormals = [];
        const finalUvs = [];
        const finalColors = [];
        const finalIndices = [];
        const materials = [];
        let overallVertexCount = 0;
        let overallIndexCount = 0;

        for (const blockType of Object.keys(geometryData)) {
            const data = geometryData[blockType];
            if (data.vertexCount === 0) continue;

            // Add the material for this group
            const material = blockTypes[blockType].material.clone();
            material.vertexColors = true;
            const materialIndex = materials.push(material) - 1;

            // Add geometry data
            finalPositions.push(...data.positions);
            finalNormals.push(...data.normals);
            finalUvs.push(...data.uvs);
            finalColors.push(...data.colors);
            
            // Remap indices to the global vertex count
            for (const index of data.indices) {
                finalIndices.push(index + overallVertexCount);
            }

            // Create a material group
            finalGeometry.addGroup(overallIndexCount, data.indices.length, materialIndex);

            overallVertexCount += data.vertexCount;
            overallIndexCount += data.indices.length;
        }

        finalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3));
        finalGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNormals, 3));
        finalGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvs, 2));
        finalGeometry.setAttribute('color', new THREE.Float32BufferAttribute(finalColors, 3));
        finalGeometry.setIndex(finalIndices);

        this.mesh = new THREE.Mesh(finalGeometry, materials);
        this.scene.add(this.mesh);
    }

    getNeighbor(x, y, z, face) {
        const [dx,dy,dz] = {px:[1,0,0],nx:[-1,0,0],py:[0,1,0],ny:[0,-1,0],pz:[0,0,1],nz:[0,0,-1]}[face];
        return getBlock(this.chunkX * C.chunkSize + x + dx, y + dy, this.chunkZ * C.chunkSize + z + dz);
    }

    calculateAO(x, y, z, face, vertexIndex) {
        const wx = this.chunkX * C.chunkSize + x;
        const wy = y;
        const wz = this.chunkZ * C.chunkSize + z;
        const aoDirs = this.getAODirections(face, vertexIndex);
        const side1 = getBlock(wx + aoDirs[0][0], wy + aoDirs[0][1], wz + aoDirs[0][2]) !== 0;
        const side2 = getBlock(wx + aoDirs[1][0], wy + aoDirs[1][1], wz + aoDirs[1][2]) !== 0;
        if (side1 && side2) return [0];
        const corner = getBlock(wx + aoDirs[2][0], wy + aoDirs[2][1], wz + aoDirs[2][2]) !== 0;
        return [3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0))];
    }
    
    getAODirections(face, vertex) {
        const px = [[[0,1,0],[0,0,-1],[0,1,-1]],[[0,-1,0],[0,0,-1],[0,-1,-1]],[[0,-1,0],[0,0,1],[0,-1,1]],[[0,1,0],[0,0,1],[0,1,1]]];
        const nx = [[[0,1,0],[0,0,1],[0,1,1]],[[0,-1,0],[0,0,1],[0,-1,1]],[[0,-1,0],[0,0,-1],[0,-1,-1]],[[0,1,0],[0,0,-1],[0,1,-1]]];
        const py = [[[0,0,-1],[-1,0,0],[-1,0,-1]],[[0,0,-1],[1,0,0],[1,0,-1]],[[0,0,1],[1,0,0],[1,0,1]],[[0,0,1],[-1,0,0],[-1,0,1]]];
        const ny = [[[0,0,1],[-1,0,0],[-1,0,1]],[[0,0,1],[1,0,0],[1,0,1]],[[0,0,-1],[1,0,0],[1,0,-1]],[[0,0,-1],[-1,0,0],[-1,0,-1]]];
        const pz = [[[0,1,0],[-1,0,0],[-1,1,0]],[[0,-1,0],[-1,0,0],[-1,-1,0]],[[0,-1,0],[1,0,0],[1,-1,0]],[[0,1,0],[1,0,0],[1,1,0]]];
        const nz = [[[0,1,0],[1,0,0],[1,1,0]],[[0,-1,0],[1,0,0],[1,-1,0]],[[0,-1,0],[-1,0,0],[-1,-1,0]],[[0,1,0],[-1,0,0],[-1,1,0]]];
        return {px,nx,py,ny,pz,nz}[face][vertex];
    }

    getFaceData(face) {
        const data = {
            px: { vertices: [{x:1,y:0,z:0},{x:1,y:1,z:0},{x:1,y:1,z:1},{x:1,y:0,z:1}], normal:[1,0,0], uv:[0,0,0,1,1,1,1,0] },
            nx: { vertices: [{x:0,y:0,z:1},{x:0,y:1,z:1},{x:0,y:1,z:0},{x:0,y:0,z:0}], normal:[-1,0,0], uv:[0,0,0,1,1,1,1,0] },
            py: { vertices: [{x:0,y:1,z:0},{x:0,y:1,z:1},{x:1,y:1,z:1},{x:1,y:1,z:0}], normal:[0,1,0], uv:[0,0,0,1,1,1,1,0] },
            ny: { vertices: [{x:0,y:0,z:1},{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:0,z:1}], normal:[0,-1,0], uv:[0,0,0,1,1,1,1,0] },
            pz: { vertices: [{x:0,y:0,z:1},{x:0,y:1,z:1},{x:1,y:1,z:1},{x:1,y:0,z:1}], normal:[0,0,1], uv:[0,0,0,1,1,1,1,0] },
            nz: { vertices: [{x:1,y:0,z:0},{x:1,y:1,z:0},{x:0,y:1,z:0},{x:0,y:0,z:0}], normal:[0,0,-1], uv:[0,0,0,1,1,1,1,0] }
        };
        return data[face];
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
