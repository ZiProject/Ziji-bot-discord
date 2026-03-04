const { Schema, model, models } = require("mongoose");

// ─── Sub-schemas ────────────────────────────────────────────────────────────

/** Snapshot of a player's in-dungeon state (not persisted to Character until run ends) */
const DungeonPlayerSchema = new Schema(
	{
		userId: { type: String, required: true },
		name: { type: String, required: true },
		class: { type: String, required: true },
		level: { type: Number, required: true },

		// Live combat stats (copy from Character at start)
		hp: { type: Number, required: true },
		maxHp: { type: Number, required: true },
		mp: { type: Number, required: true },
		maxMp: { type: Number, required: true },
		atk: { type: Number, required: true },
		def: { type: Number, required: true },
		spd: { type: Number, required: true },
		matk: { type: Number, required: true },
		mdef: { type: Number, required: true },
		crit: { type: Number, required: true },
		critDmg: { type: Number, required: true },

		// Active effects (cleared each floor)
		statusEffects: { type: Array, default: [] },
		buffs: { type: Array, default: [] },

		// Loot collected this run
		lootCollected: { type: Array, default: [] },
		xpEarned: { type: Number, default: 0 },
		goldEarned: { type: Number, default: 0 },

		downed: { type: Boolean, default: false }, // knocked out — can be revived
		escaped: { type: Boolean, default: false }, // fled the dungeon
	},
	{ _id: false },
);

/** Snapshot of the current enemy/boss on this floor */
const DungeonEnemySchema = new Schema(
	{
		monsterId: { type: String, required: true },
		name: { type: String, required: true },
		hp: { type: Number, required: true },
		maxHp: { type: Number, required: true },
		mp: { type: Number, default: 0 },
		atk: { type: Number, required: true },
		def: { type: Number, required: true },
		spd: { type: Number, required: true },
		matk: { type: Number, default: 0 },
		mdef: { type: Number, default: 0 },
		element: { type: String, default: "none" },
		weakness: { type: [String], default: [] },
		skills: { type: [String], default: [] },
		statusEffects: { type: Array, default: [] },
		buffs: { type: Array, default: [] },
		isElite: { type: Boolean, default: false },
		isBoss: { type: Boolean, default: false },
	},
	{ _id: false },
);

/** A record of what happened on each completed floor */
const FloorLogSchema = new Schema(
	{
		floorNumber: { type: Number, required: true },
		type: { type: String, required: true }, // "combat","elite","trap","puzzle","rest","treasure","miniboss","boss"
		outcome: { type: String, required: true }, // "victory","defeat","passed","failed","skipped"
		xpGained: { type: Number, default: 0 },
		goldGained: { type: Number, default: 0 },
		loot: { type: [String], default: [] },
		turnsUsed: { type: Number, default: 0 },
	},
	{ _id: false },
);

// ─── Main Schema ────────────────────────────────────────────────────────────

const DungeonRunSchema = new Schema(
	{
		// Participants
		partyLeaderId: { type: String, required: true },
		guildId: { type: String, required: true },
		players: { type: [DungeonPlayerSchema], required: true },

		// Dungeon config
		tier: { type: String, required: true, enum: ["D", "C", "B", "A", "S", "EX"] },
		dungeonName: { type: String, required: true },
		totalFloors: { type: Number, required: true },
		seed: { type: Number, required: true }, // RNG seed for reproducible floors

		// Progress
		currentFloor: { type: Number, default: 1 },
		floorType: { type: String, default: "combat" },
		phase: {
			type: String,
			default: "explore",
			enum: ["explore", "combat", "reward", "trap", "puzzle", "rest", "treasure", "complete", "failed"],
		},

		// Current combat state (null when not in combat)
		currentEnemies: { type: [DungeonEnemySchema], default: [] },
		turnOrder: { type: [String], default: [] }, // userIds + "enemy_N"
		currentTurnIdx: { type: Number, default: 0 },
		turnCount: { type: Number, default: 0 },
		comboCounters: { type: Map, of: Number, default: {} }, // userId → combo

		// Floor generation
		floorPlan: { type: [String], default: [] }, // pre-rolled floor type sequence

		// History
		floorLog: { type: [FloorLogSchema], default: [] },

		// Discord message IDs to update
		channelId: { type: String, required: true },
		messageId: { type: String, default: null },

		// Lifecycle
		active: { type: Boolean, default: true },
		startedAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
		expiresAt: { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) }, // 2hr TTL
	},
	{ timestamps: true },
);

// ─── Indexes ────────────────────────────────────────────────────────────────
DungeonRunSchema.index({ partyLeaderId: 1, active: 1 });
DungeonRunSchema.index({ "players.userId": 1, active: 1 });
DungeonRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

// ─── Methods ────────────────────────────────────────────────────────────────

/** Get a player snapshot by userId */
DungeonRunSchema.methods.getPlayer = function (userId) {
	return this.players.find((p) => p.userId === userId) ?? null;
};

/** Get all living players */
DungeonRunSchema.methods.alivePlayers = function () {
	return this.players.filter((p) => !p.downed && !p.escaped);
};

/** Check if combat is over */
DungeonRunSchema.methods.isCombatOver = function () {
	const enemiesDead = this.currentEnemies.every((e) => e.hp <= 0);
	const playersDeadOrEscaped = this.alivePlayers().length === 0;
	return { victory: enemiesDead, defeat: playersDeadOrEscaped };
};

/** Advance to the next turn in order */
DungeonRunSchema.methods.nextTurn = function () {
	this.currentTurnIdx = (this.currentTurnIdx + 1) % this.turnOrder.length;
	this.turnCount++;
	return this.turnOrder[this.currentTurnIdx];
};

/** Whose turn is it right now? Returns userId or "enemy_N" */
DungeonRunSchema.methods.currentActor = function () {
	return this.turnOrder[this.currentTurnIdx];
};

module.exports = models.DungeonRun || model("DungeonRun", DungeonRunSchema);
