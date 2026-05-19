
export const testResults = [];

export function describe(name, fn) {
    console.log(`%c${name}`, 'font-weight: bold; font-size: 1.2em;');
    fn();
}

export function it(name, fn) {
    try {
        fn();
        console.log(`%c  ✓ ${name}`, 'color: green;');
        testResults.push({ name, status: 'passed' });
    } catch (e) {
        console.error(`%c  ✗ ${name}`, 'color: red;');
        console.error(e);
        testResults.push({ name, status: 'failed', error: e });
    }
}

export const expect = (actual) => ({
    to: {
        be: {
            true: () => {
                if (actual !== true) throw new Error(`Expected ${actual} to be true`);
            },
            false: () => {
                if (actual !== false) throw new Error(`Expected ${actual} to be false`);
            },
            equal: (expected) => {
                if (actual !== expected) throw new Error(`Expected ${actual} to equal ${expected}`);
            },
            null: () => {
                if (actual !== null) throw new Error(`Expected ${actual} to be null`);
            }
        },
        equal: (expected) => {
            if (actual !== expected) throw new Error(`Expected ${actual} to equal ${expected}`);
        },
        contain: (item) => {
            if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
        },
        not: {
            contain: (item) => {
                if (actual.includes(item)) throw new Error(`Expected array to not contain ${item}`);
            }
        }
    }
});

// Mock THREE.js for testing without browser/canvas
window.THREE = {
    Scene: class {
        add() { }
        remove() { }
    },
    Object3D: class {
        constructor() {
            this.position = { set: () => { }, copy: () => { }, x: 0, y: 0, z: 0 };
            this.scale = { set: () => { } };
            this.updateMatrix = () => { };
        }
    },
    Mesh: class {
        constructor() {
            this.position = { set: () => { }, copy: () => { }, x: 0, y: 0, z: 0 };
        }
    },
    BoxGeometry: class { },
    MeshBasicMaterial: class { },
    MeshLambertMaterial: class { },
    InstancedMesh: class {
        constructor() {
            this.instanceMatrix = { needsUpdate: false };
            this.instanceColor = { needsUpdate: false };
        }
        setMatrixAt() { }
        setColorAt() { }
    },
    TextureLoader: class {
        load() { return { clone: () => ({ repeat: { set: () => { } } }) }; }
    },
    Color: class {
        constructor() { }
        lerp() { return this; }
    },
    RepeatWrapping: 1000,
    Vector3: class {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }
};
