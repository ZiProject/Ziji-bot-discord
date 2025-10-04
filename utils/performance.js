/**
 * @fileoverview Performance optimization utilities
 * @description Các tiện ích tối ưu hóa hiệu suất cho Ziji Bot
 */

const { performance } = require('perf_hooks');

/**
 * Memory management utilities
 */
class MemoryManager {
	constructor() {
		this.gcInterval = null;
		this.memoryThreshold = 100 * 1024 * 1024; // 100MB
		this.lastGcTime = 0;
		this.gcCooldown = 30000; // 30 seconds
	}

	/**
	 * Start automatic garbage collection
	 */
	startAutoGC() {
		if (this.gcInterval) return;
		
		this.gcInterval = setInterval(() => {
			this.forceGC();
		}, 60000); // Every minute
	}

	/**
	 * Stop automatic garbage collection
	 */
	stopAutoGC() {
		if (this.gcInterval) {
			clearInterval(this.gcInterval);
			this.gcInterval = null;
		}
	}

	/**
	 * Force garbage collection if available
	 */
	forceGC() {
		const now = Date.now();
		if (now - this.lastGcTime < this.gcCooldown) return;

		if (global.gc) {
			const before = process.memoryUsage();
			global.gc();
			const after = process.memoryUsage();
			
			console.log(`GC: ${Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024)}MB freed`);
			this.lastGcTime = now;
		}
	}

	/**
	 * Get memory usage statistics
	 */
	getMemoryStats() {
		const usage = process.memoryUsage();
		return {
			rss: Math.round(usage.rss / 1024 / 1024),
			heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
			heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
			external: Math.round(usage.external / 1024 / 1024),
			arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
		};
	}

	/**
	 * Check if memory usage is high
	 */
	isMemoryHigh() {
		const stats = this.getMemoryStats();
		return stats.heapUsed > this.memoryThreshold / 1024 / 1024;
	}
}

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
	constructor() {
		this.metrics = new Map();
		this.startTimes = new Map();
	}

	/**
	 * Start timing an operation
	 */
	startTimer(name) {
		this.startTimes.set(name, performance.now());
	}

	/**
	 * End timing an operation
	 */
	endTimer(name) {
		const startTime = this.startTimes.get(name);
		if (!startTime) return null;

		const duration = performance.now() - startTime;
		this.startTimes.delete(name);

		// Store metric
		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}
		this.metrics.get(name).push(duration);

		// Keep only last 100 measurements
		const measurements = this.metrics.get(name);
		if (measurements.length > 100) {
			measurements.shift();
		}

		return duration;
	}

	/**
	 * Get average time for an operation
	 */
	getAverageTime(name) {
		const measurements = this.metrics.get(name);
		if (!measurements || measurements.length === 0) return 0;

		return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
	}

	/**
	 * Get all performance metrics
	 */
	getAllMetrics() {
		const result = {};
		for (const [name, measurements] of this.metrics) {
			if (measurements.length > 0) {
				result[name] = {
					average: this.getAverageTime(name),
					count: measurements.length,
					latest: measurements[measurements.length - 1]
				};
			}
		}
		return result;
	}
}

/**
 * Cache management utilities
 */
class CacheManager {
	constructor(maxSize = 1000, ttl = 300000) { // 5 minutes default TTL
		this.cache = new Map();
		this.maxSize = maxSize;
		this.ttl = ttl;
		this.timers = new Map();
	}

	/**
	 * Set cache value
	 */
	set(key, value, customTTL = null) {
		// Remove oldest entries if cache is full
		if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			this.delete(firstKey);
		}

		this.cache.set(key, {
			value,
			timestamp: Date.now()
		});

		// Set TTL timer
		const ttl = customTTL || this.ttl;
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
		}
		
		this.timers.set(key, setTimeout(() => {
			this.delete(key);
		}, ttl));
	}

	/**
	 * Get cache value
	 */
	get(key) {
		const item = this.cache.get(key);
		if (!item) return null;

		// Check if expired
		if (Date.now() - item.timestamp > this.ttl) {
			this.delete(key);
			return null;
		}

		return item.value;
	}

	/**
	 * Delete cache value
	 */
	delete(key) {
		this.cache.delete(key);
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}
	}

	/**
	 * Clear all cache
	 */
	clear() {
		this.cache.clear();
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			usage: Math.round((this.cache.size / this.maxSize) * 100)
		};
	}
}

/**
 * Debounce utility
 */
function debounce(func, wait, immediate = false) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};
		const callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func(...args);
	};
}

/**
 * Throttle utility
 */
function throttle(func, limit) {
	let inThrottle;
	return function executedFunction(...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

module.exports = {
	MemoryManager,
	PerformanceMonitor,
	CacheManager,
	debounce,
	throttle
};
