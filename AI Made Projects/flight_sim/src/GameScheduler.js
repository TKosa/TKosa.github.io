/**
 * Game-time-based scheduler for callbacks that should respect game pause state.
 * Unlike setTimeout which uses wall-clock time, this uses game ticks.
 */
export class GameScheduler {
    constructor() {
        this.gameTime = 0; // Current game time in seconds
        this.callbacks = []; // Priority queue of {time, callback}
    }

    /**
     * Update game time and execute any pending callbacks
     * @param {number} deltaTime - Time elapsed in seconds since last tick
     */
    tick(deltaTime) {
        this.gameTime += deltaTime;

        // Execute all callbacks whose time has come
        while (this.callbacks.length > 0 && this.callbacks[0].time <= this.gameTime) {
            const { callback } = this.callbacks.shift();
            try {
                callback();
            } catch (error) {
                console.error('Error in scheduled callback:', error);
            }
        }
    }

    /**
     * Schedule a callback to run after a delay (in game seconds)
     * @param {Function} callback - Function to call
     * @param {number} delaySeconds - Delay in game seconds
     * @returns {Object} Handle with cancel() method
     */
    setTimeout(callback, delaySeconds) {
        const executeTime = this.gameTime + delaySeconds;
        const entry = { time: executeTime, callback };

        // Insert in sorted order (binary search for efficiency)
        let low = 0;
        let high = this.callbacks.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (this.callbacks[mid].time < executeTime) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        this.callbacks.splice(low, 0, entry);

        // Return handle to cancel
        return {
            cancel: () => {
                const index = this.callbacks.indexOf(entry);
                if (index !== -1) {
                    this.callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Get current game time
     * @returns {number} Current game time in seconds
     */
    now() {
        return this.gameTime;
    }

    /**
     * Clear all pending callbacks
     */
    clear() {
        this.callbacks = [];
    }
}
