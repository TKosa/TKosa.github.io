
export class Scene {
    constructor() {
        this.children = [];
    }
    add(obj) {
        this.children.push(obj);
    }
    remove(obj) {
        const index = this.children.indexOf(obj);
        if (index > -1) {
            this.children.splice(index, 1);
        }
    }
}

export class Object3D {
    constructor() {
        this.position = new Vector3();
        this.scale = new Vector3(1, 1, 1);
        this.matrix = {};
    }
    updateMatrix() { }
}

export class Mesh extends Object3D {
    constructor(geometry, material) {
        super();
        this.geometry = geometry;
        this.material = material;
    }
}

export class BoxGeometry { }
export class MeshBasicMaterial { }
export class MeshLambertMaterial { }

export class InstancedMesh extends Mesh {
    constructor(geometry, material, count) {
        super(geometry, material);
        this.count = count;
        this.instanceMatrix = { needsUpdate: false };
        this.instanceColor = { needsUpdate: false };
    }
    setMatrixAt(index, matrix) { }
    setColorAt(index, color) { }
}

export class TextureLoader {
    load() {
        return {
            clone: () => ({
                repeat: { set: () => { } },
                wrapS: 0,
                wrapT: 0
            }),
            wrapS: 0,
            wrapT: 0,
            repeat: { set: () => { } }
        };
    }
}

export class Color {
    constructor(hex) { }
    lerp() { return this; }
}

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
}

export const RepeatWrapping = 1000;
