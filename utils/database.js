/**
 * @fileoverview Database optimization utilities
 * @description Các tiện ích tối ưu hóa database cho Ziji Bot
 */

const mongoose = require('mongoose');

/**
 * Database connection manager with optimization
 */
class DatabaseManager {
	constructor() {
		this.connection = null;
		this.isConnected = false;
		this.connectionOptions = {
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000,
			socketTimeoutMS: 45000,
			bufferMaxEntries: 0,
			bufferCommands: false,
			// Optimize for performance
			readPreference: 'secondaryPreferred',
			// Enable compression
			compressors: ['zlib'],
			// Connection pooling
			maxIdleTimeMS: 30000,
			// Retry logic
			retryWrites: true,
			retryReads: true,
		};
	}

	/**
	 * Connect to MongoDB with optimized settings
	 */
	async connect(uri) {
		try {
			if (this.isConnected) return this.connection;

			this.connection = await mongoose.connect(uri, this.connectionOptions);
			this.isConnected = true;

			// Set up connection event handlers
			this.setupEventHandlers();

			console.log('✅ Database connected successfully');
			return this.connection;
		} catch (error) {
			console.error('❌ Database connection failed:', error);
			throw error;
		}
	}

	/**
	 * Setup connection event handlers
	 */
	setupEventHandlers() {
		const db = mongoose.connection;

		db.on('connected', () => {
			console.log('📊 Database connected');
		});

		db.on('error', (error) => {
			console.error('📊 Database error:', error);
		});

		db.on('disconnected', () => {
			console.log('📊 Database disconnected');
			this.isConnected = false;
		});

		db.on('reconnected', () => {
			console.log('📊 Database reconnected');
			this.isConnected = true;
		});
	}

	/**
	 * Disconnect from database
	 */
	async disconnect() {
		try {
			if (this.connection) {
				await mongoose.disconnect();
				this.isConnected = false;
				console.log('📊 Database disconnected');
			}
		} catch (error) {
			console.error('❌ Error disconnecting from database:', error);
		}
	}

	/**
	 * Get connection status
	 */
	getStatus() {
		return {
			connected: this.isConnected,
			readyState: mongoose.connection.readyState,
			host: mongoose.connection.host,
			port: mongoose.connection.port,
			name: mongoose.connection.name
		};
	}

	/**
	 * Create optimized indexes
	 */
	async createIndexes() {
		try {
			const { ZiUser, ZiAutoresponder, ZiWelcome, ZiGuild, ZiConfess } = require('../startup/mongoDB');

			// Create compound indexes for better query performance
			await ZiUser.createIndexes([
				{ userID: 1, level: -1 },
				{ userID: 1, xp: -1 },
				{ level: -1, xp: -1 }
			]);

			await ZiAutoresponder.createIndexes([
				{ guildId: 1, trigger: 1 }
			]);

			await ZiWelcome.createIndexes([
				{ guildId: 1 }
			]);

			await ZiGuild.createIndexes([
				{ guildId: 1 },
				{ 'joinToCreate.tempChannels.channelId': 1 },
				{ 'joinToCreate.tempChannels.ownerId': 1 }
			]);

			await ZiConfess.createIndexes([
				{ guildId: 1 },
				{ 'confessions.id': 1 },
				{ 'confessions.status': 1 }
			]);

			console.log('✅ Database indexes created successfully');
		} catch (error) {
			console.error('❌ Error creating indexes:', error);
		}
	}

	/**
	 * Optimize database queries
	 */
	optimizeQueries() {
		// Set mongoose options for better performance
		mongoose.set('strictQuery', false);
		mongoose.set('bufferCommands', false);
		mongoose.set('bufferMaxEntries', 0);
	}
}

/**
 * Query optimization utilities
 */
class QueryOptimizer {
	/**
	 * Optimize user queries
	 */
	static optimizeUserQuery(filters = {}, options = {}) {
		const defaultOptions = {
			lean: true, // Return plain objects instead of Mongoose documents
			limit: 100,
			sort: { xp: -1 }
		};

		return { ...defaultOptions, ...options };
	}

	/**
	 * Optimize guild queries
	 */
	static optimizeGuildQuery(filters = {}, options = {}) {
		const defaultOptions = {
			lean: true,
			limit: 50
		};

		return { ...defaultOptions, ...options };
	}

	/**
	 * Create aggregation pipeline for leaderboard
	 */
	static createLeaderboardPipeline(limit = 10) {
		return [
			{ $sort: { xp: -1 } },
			{ $limit: limit },
			{ $project: { userID: 1, name: 1, xp: 1, level: 1, coin: 1 } }
		];
	}

	/**
	 * Create aggregation pipeline for guild stats
	 */
	static createGuildStatsPipeline(guildId) {
		return [
			{ $match: { guildId } },
			{ $unwind: '$joinToCreate.tempChannels' },
			{ $group: {
				_id: '$guildId',
				totalTempChannels: { $sum: 1 },
				lockedChannels: { $sum: { $cond: ['$joinToCreate.tempChannels.locked', 1, 0] } }
			}}
		];
	}
}

/**
 * Cache layer for database queries
 */
class DatabaseCache {
	constructor(ttl = 300000) { // 5 minutes default
		this.cache = new Map();
		this.ttl = ttl;
		this.timers = new Map();
	}

	/**
	 * Get cached data
	 */
	get(key) {
		const item = this.cache.get(key);
		if (!item) return null;

		if (Date.now() - item.timestamp > this.ttl) {
			this.delete(key);
			return null;
		}

		return item.data;
	}

	/**
	 * Set cached data
	 */
	set(key, data) {
		this.cache.set(key, {
			data,
			timestamp: Date.now()
		});

		// Set TTL timer
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
		}

		this.timers.set(key, setTimeout(() => {
			this.delete(key);
		}, this.ttl));
	}

	/**
	 * Delete cached data
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
}

module.exports = {
	DatabaseManager,
	QueryOptimizer,
	DatabaseCache
};
