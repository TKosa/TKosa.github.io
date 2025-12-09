/**
 * Performance monitoring utility for tracking frame timings
 */
export class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.logThreshold = options.logThreshold ?? 16; // Log if frame takes longer than 16ms (60fps)
        this.sampleSize = options.sampleSize ?? 60; // Track averages over 60 frames

        this.timings = new Map(); // name -> array of timing samples
        this.currentFrame = new Map(); // name -> start time for current measurement
        this.frameCount = 0;
    }

    /**
     * Start timing a section
     */
    startTiming(name) {
        if (!this.enabled) return;
        this.currentFrame.set(name, performance.now());
    }

    /**
     * End timing a section and record the duration
     */
    endTiming(name) {
        if (!this.enabled) return;

        const startTime = this.currentFrame.get(name);
        if (startTime === undefined) {
            console.warn(`PerformanceMonitor: No start time for '${name}'`);
            return;
        }

        const duration = performance.now() - startTime;
        this.currentFrame.delete(name);

        // Store timing sample
        if (!this.timings.has(name)) {
            this.timings.set(name, []);
        }

        const samples = this.timings.get(name);
        samples.push(duration);

        // Keep only recent samples
        if (samples.length > this.sampleSize) {
            samples.shift();
        }
    }

    /**
     * Log performance stats periodically
     */
    logStats() {
        if (!this.enabled) return;

        this.frameCount++;

        // Log every 60 frames (approximately once per second at 60fps)
        if (this.frameCount % 60 !== 0) {
            return;
        }

        const stats = [];
        let totalFrameTime = 0;
        let worstFrame = 0;

        for (const [name, samples] of this.timings.entries()) {
            if (samples.length === 0) continue;

            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            const max = Math.max(...samples);
            const min = Math.min(...samples);

            stats.push({ name, avg, max, min });
            totalFrameTime += avg;

            // Track worst spike for Full RAF Frame specifically
            if (name === '=== Full RAF Frame ===' && max > worstFrame) {
                worstFrame = max;
            }
        }

        // Sort by MAX time (worst spikes first) to identify spike sources
        stats.sort((a, b) => b.max - a.max);

        // Warning if we had any spikes over 16ms
        const hadSpike = worstFrame > 16.67;
        const icon = hadSpike ? '🔴' : (totalFrameTime > this.logThreshold ? '⚠️' : '✅');
        const status = hadSpike ? 'SPIKE!' : (totalFrameTime > this.logThreshold ? 'SLOW' : 'GOOD');

        console.group(`${icon} Performance Report (last 60 frames) - ${status}`);
        console.log(`Total frame time: ${totalFrameTime.toFixed(2)}ms avg (target: <${this.logThreshold}ms)`);
        if (hadSpike) {
            console.warn(`⚠️ WORST SPIKE: ${worstFrame.toFixed(2)}ms (violates 60fps threshold!)`);
        }
        console.table(stats.map(s => ({
            Section: s.name,
            'Avg (ms)': s.avg.toFixed(2),
            'Max (ms)': s.max.toFixed(2),
            'Min (ms)': s.min.toFixed(2),
            'Spike?': s.max > 16.67 ? '🔴 YES' : (s.max > 10 ? '⚠️' : '✅')
        })));
        console.groupEnd();
    }

    /**
     * Get current stats without logging
     */
    getStats() {
        const stats = {};
        for (const [name, samples] of this.timings.entries()) {
            if (samples.length === 0) continue;

            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            const max = Math.max(...samples);

            stats[name] = { avg, max, samples: samples.length };
        }
        return stats;
    }

    /**
     * Clear all timing data
     */
    reset() {
        this.timings.clear();
        this.currentFrame.clear();
        this.frameCount = 0;
    }

    /**
     * Enable or disable monitoring
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }
}
