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
        
        this.material = new THREE.MeshLambertMaterial({ 
            map: blockTypes[1].material.map,
            vertexColors: true,
            side: THREE.FrontSide
        });

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
                const height = Math.round((noiseVal + 1) / 2 * (C.worldHeight / 2)) + Math.floor(C.worldHeight / 4);

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
        const index = y * C.chunkSize * C.chunkSize + z * C.chunkSize + x;
        return this.data[index];
    }
    
    setBlock(x, y, z, type, update = true) {
        const index = y * C.chunkSize * C.chunkSize + z * C.chunkSize + x;
        if (index < 0 || index >= this.data.length) return;
        this.data[index] = type;
        if (update) {
            this.updateMesh();
        }
    }

    updateMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        const positions = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        const indices = []; // <<< The missing piece!
        let vertexCount = 0;

        const aoValues = [0.5, 0.7, 0.85, 1.0]; // Adjusted for better contrast

        for (let x = 0; x < C.chunkSize; x++) {
            for (let y = 0; y < C.worldHeight; y++) {
                for (let z = 0; z < C.chunkSize; z++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === 0) continue;

                    const worldX = this.chunkX * C.chunkSize + x;
                    const worldY = y;
                    const worldZ = this.chunkZ * C.chunkSize + z;
                    
                    for (const face of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
                        const neighbor = this.getNeighbor(x, y, z, face);
                        if (neighbor === 0) {
                            const { vertices, normal, uv } = this.getFaceData(face);
                            
                            for (let i = 0; i < 4; i++) {
                                const vert = vertices[i];
                                positions.push(vert.x + worldX, vert.y + worldY, vert.z + worldZ);
                                normals.push(...normal);
                                uvs.push(uv[i * 2], uv[i * 2 + 1]);

                                const [ao] = this.calculateAO(x, y, z, face, i);
                                const brightness = aoValues[ao];
                                colors.push(brightness, brightness, brightness);
                            }
                            
                            // *** FIX: Add indices for the two triangles of the quad ***
                            indices.push(vertexCount, vertexCount + 1, vertexCount + 2);
                            indices.push(vertexCount, vertexCount + 2, vertexCount + 3);
                            vertexCount += 4;
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
        
        // *** FIX: Set the index for the geometry ***
        geometry.setIndex(indices);

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
    }
    
    getNeighbor(x, y, z, face) {
        const [dx, dy, dz] = {px:[1,0,0], nx:[-1,0,0], py:[0,1,0], ny:[0,-1,0], pz:[0,0,1], nz:[0,0,-1]}[face];
        return getBlock(this.chunkX * C.chunkSize + x + dx, y + dy, this.chunkZ * C.chunkSize + z + dz);
    }
    
    calculateAO(x, y, z, face, vertexIndex) {
        const wx = this.chunkX * C.chunkSize + x;
        const wy = y;
        const wz = this.chunkZ * C.chunkSize + z;

        const aoDirs = this.getAODirections(face, vertexIndex);
        const side1 = getBlock(wx + aoDirs[0][0], wy + aoDirs[0][1], wz + aoDirs[0][2]) !== 0;
        const side2 = getBlock(wx + aoDirs[1][0], wy + aoDirs[1][1], wz + aoDirs[1][2]) !== 0;
        
        if (side1 && side2) return [0, 'Both sides blocked'];
        
        const corner = getBlock(wx + aoDirs[2][0], wy + aoDirs[2][1], wz + aoDirs[2][2]) !== 0;
        
        const aoValue = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
        return [3 - aoValue, 'Calculation'];
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
        // Defines vertices in counter-clockwise order for correct face normals
        const data = {
            px: { vertices: [{x:1,y:0,z:0},{x:1,y:1,z:0},{x:1,y:1,z:1},{x:1,y:0,z:1}], normal: [1,0,0], uv: [0,0, 0,1, 1,1, 1,0] },
            nx: { vertices: [{x:0,y:0,z:1},{x:0,y:1,z:1},{x:0,y:1,z:0},{x:0,y:0,z:0}], normal: [-1,0,0], uv: [0,0, 0,1, 1,1, 1,0] },
            py: { vertices: [{x:0,y:1,z:0},{x:0,y:1,z:1},{x:1,y:1,z:1},{x:1,y:1,z:0}], normal: [0,1,0], uv: [0,0, 0,1, 1,1, 1,0] },
            ny: { vertices: [{x:0,y:0,z:1},{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:0,z:1}], normal: [0,-1,0], uv: [0,0, 0,1, 1,1, 1,0] },
            pz: { vertices: [{x:0,y:0,z:1},{x:0,y:1,z:1},{x:1,y:1,z:1},{x:1,y:0,z:1}], normal: [0,0,1], uv: [0,0, 0,1, 1,1, 1,0] },
            nz: { vertices: [{x:1,y:0,z:0},{x:1,y:1,z:0},{x:0,y:1,z:0},{x:0,y:0,z:0}], normal: [0,0,-1], uv: [0,0, 0,1, 1,1, 1,0] }
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
