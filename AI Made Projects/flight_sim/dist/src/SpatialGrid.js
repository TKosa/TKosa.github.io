import * as THREE from 'three';

/**
 * A Spatial Grid implementation for efficient 2D spatial querying in the XZ plane.
 * Divides the world into a fixed grid of cells.
 */
export class SpatialGrid {
    /**
     * @param {Object} bounds - The bounds of the world { x, z, width, depth }
     * @param {number} cellSize - Size of each cell (e.g., 100)
     */
    constructor(bounds, cellSize = 100) {
        this.bounds = bounds;
        this.cellSize = cellSize;

        this.cols = Math.ceil(bounds.width / cellSize);
        this.rows = Math.ceil(bounds.depth / cellSize);

        // Initialize grid as a 1D array of Sets for better performance than array of arrays
        this.cells = new Array(this.cols * this.rows);
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = new Set();
        }

        // Reusable arrays to avoid GC
        this.tempResults = [];
        this.queryIds = new Set(); // To deduplicate results
    }

    /**
     * Get the cell index for a given position
     * @param {number} x 
     * @param {number} z 
     * @returns {number} Index in the cells array, or -1 if out of bounds
     */
    getIndex(x, z) {
        const col = Math.floor((x - this.bounds.x) / this.cellSize);
        const row = Math.floor((z - this.bounds.z) / this.cellSize);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return -1;
        }

        return row * this.cols + col;
    }

    /**
     * Add an object to the grid
     * @param {Object} object - Object with a .position (THREE.Vector3) property
     */
    add(object) {
        if (!object || !object.position) return;

        const index = this.getIndex(object.position.x, object.position.z);
        if (index !== -1) {
            this.cells[index].add(object);
            // Store the index on the object for fast removal/updates
            object._gridIndex = index;
        }
    }

    /**
     * Remove an object from the grid
     * @param {Object} object 
     */
    remove(object) {
        const index = object._gridIndex;
        if (index !== undefined && index !== -1) {
            this.cells[index].delete(object);
            object._gridIndex = undefined;
        }
    }

    /**
     * Update an object's position in the grid.
     * Call this when an object moves.
     * @param {Object} object 
     */
    updateClient(object) {
        if (!object || !object.position) return;

        const newIndex = this.getIndex(object.position.x, object.position.z);
        const oldIndex = object._gridIndex;

        if (newIndex !== oldIndex) {
            if (oldIndex !== undefined && oldIndex !== -1) {
                this.cells[oldIndex].delete(object);
            }
            if (newIndex !== -1) {
                this.cells[newIndex].add(object);
                object._gridIndex = newIndex;
            } else {
                object._gridIndex = undefined; // Object moved out of bounds
            }
        }
    }

    /**
     * Find all objects within a radius of a position.
     * @param {THREE.Vector3} position - Center position
     * @param {number} radius - Radius to check
     * @returns {Array} Array of objects within the radius
     */
    checkArea(position, radius) {
        this.tempResults.length = 0;
        this.queryIds.clear();
        const radiusSq = radius * radius;

        // Calculate range of cells to check
        const minX = position.x - radius;
        const maxX = position.x + radius;
        const minZ = position.z - radius;
        const maxZ = position.z + radius;

        const startCol = Math.max(0, Math.floor((minX - this.bounds.x) / this.cellSize));
        const endCol = Math.min(this.cols - 1, Math.floor((maxX - this.bounds.x) / this.cellSize));
        const startRow = Math.max(0, Math.floor((minZ - this.bounds.z) / this.cellSize));
        const endRow = Math.min(this.rows - 1, Math.floor((maxZ - this.bounds.z) / this.cellSize));

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const index = row * this.cols + col;
                const cell = this.cells[index];

                for (const obj of cell) {
                    // Deduplicate (an object might be in multiple cells if we supported that, 
                    // but here objects are in 1 cell. However, keeping this safe.)
                    if (this.queryIds.has(obj)) continue;

                    const distSq = obj.position.distanceToSquared(position);
                    if (distSq <= radiusSq) {
                        this.tempResults.push(obj);
                        this.queryIds.add(obj);
                    }
                }
            }
        }

        return this.tempResults;
    }

    /**
     * Clear the entire grid
     */
    clear() {
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].clear();
        }
    }
}

// Define bounds for the game world (centered at 0,0 with size 2400x2400)
const WORLD_BOUNDS = { x: -1200, z: -1200, width: 2400, depth: 2400 };

// Export instantiated grids
export const enemyGrid = new SpatialGrid(WORLD_BOUNDS, 100); // 100x100 cells
export const buildingGrid = new SpatialGrid(WORLD_BOUNDS, 200); // Larger cells for larger static buildings
