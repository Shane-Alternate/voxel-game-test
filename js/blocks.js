import * as THREE from 'three';

function createColorTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

const textures = {
    grass: createColorTexture('#55902f'),
    dirt: createColorTexture('#8b4513'),
    stone: createColorTexture('#808080'),
    wood: createColorTexture('#654321'),
    leaves: createColorTexture('#228B22'),
};

export const materials = {
    grass: new THREE.MeshLambertMaterial({ map: textures.grass }),
    dirt: new THREE.MeshLambertMaterial({ map: textures.dirt }),
    stone: new THREE.MeshLambertMaterial({ map: textures.stone }),
    wood: new THREE.MeshLambertMaterial({ map: textures.wood }),
    leaves: new THREE.MeshLambertMaterial({ map: textures.leaves }),
};

export const blockTypes = {
    1: { name: 'grass', material: materials.grass },
    2: { name: 'dirt', material: materials.dirt },
    3: { name: 'stone', material: materials.stone },
    4: { name: 'wood', material: materials.wood },
    5: { name: 'leaves', material: materials.leaves },
};
