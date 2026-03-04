const { Schema, model, models } = require("mongoose");

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const StatSchema = new Schema(
	{
		hp: { type: Number, default: 100 },
		maxHp: { type: Number, default: 100 },
		mp: { type: Number, default: 50 },
		maxMp: { type: Number, default: 50 },
		atk: { type: Number, default: 10 },
		def: { type: Number, default: 5 },
		spd: { type: Number, default: 10 },
		matk: { type: Number, default: 10 },
		mdef: { type: Number, default: 5 },
		crit: { type: Number, default: 0.05 }, // 5% base
		critDmg: { type: Number, default: 0.5 }, // +50% damage on crit
	},
	{ _id: false },
);

const SkillSchema = new Schema(
	{
		skillId: { type: String, required: true },
		rank: { type: Number, default: 1, min: 1, max: 5 },
	},
	{ _id: false },
);

const EquipmentSchema = new Schema(
	{
		weapon: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		armor: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		helmet: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		boots: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		gloves: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		acc1: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		acc2: { type: Schema.Types.ObjectId, ref: "Item", default: null },
		relic: { type: Schema.Types.ObjectId, ref: "Item", default: null },
	},
	{ _id: false },
);

const InventorySchema = new Schema(
	{
		itemId: { type: String, required: true },
		quantity: { type: Number, default: 1, min: 0 },
	},
	{ _id: false },
);

const CurrencySchema = new Schema(
	{
		gold: { type: Number, default: 500 },
		gems: { type: Number, default: 0 },
		pvpTokens: { type: Number, default: 0 },
		factionTokens: { type: Number, default: 0 },
		stardust: { type: Number, default: 0 },
		dungeonSeals: { type: Number, default: 3 },
		darkCrystals: { type: Number, default: 0 },
	},
	{ _id: false },
);

const CombatStatsSchema = new Schema(
	{
		wins: { type: Number, default: 0 },
		losses: { type: Number, default: 0 },
		killCount: { type: Number, default: 0 },
		dungeonClears: { type: Number, default: 0 },
		bossKills: { type: Number, default: 0 },
	},
	{ _id: false },
);

const StatusEffectSchema = new Schema(
	{
		type: { type: String, required: true }, // "burn", "poison", "stun", etc.
		stacks: { type: Number, default: 1 },
		duration: { type: Number, default: 2 }, // turns remaining
		value: { type: Number, default: 0 }, // DoT value or % modifier
		sourceId: { type: String, default: null }, // who applied it
	},
	{ _id: false },
);

const BuffSchema = new Schema(
	{
		type: { type: String, required: true }, // "regen", "shield", "haste", etc.
		duration: { type: Number, default: 2 },
		value: { type: Number, default: 0 },
		flat: { type: Number, default: 0 }, // flat absorb for shields
	},
	{ _id: false },
);

const QuestSchema = new Schema(
	{
		questId: { type: String, required: true },
		type: { type: String, required: true }, // "combat","dungeon","craft","social"
		objective: { type: String, required: true },
		progress: { type: Number, default: 0 },
		target: { type: Number, required: true },
		reward: {
			xp: { type: Number, default: 0 },
			gold: { type: Number, default: 0 },
			gems: { type: Number, default: 0 },
			items: { type: [String], default: [] },
		},
		completed: { type: Boolean, default: false },
		isWeekly: { type: Boolean, default: false },
	},
	{ _id: false },
);

// ─── Main Schema ────────────────────────────────────────────────────────────

const CharacterSchema = new Schema(
	{
		// Identity
		userId: { type: String, required: true, index: true },
		guildId: { type: String, required: true, index: true },
		name: { type: String, required: true, maxlength: 32 },

		// Progression
		class: {
			type: String,
			required: true,
			enum: ["warrior", "mage", "rogue", "cleric", "ranger", "berserker", "summoner", "paladin", "necromancer", "elementalist"],
		},
		advancedClass: { type: String, default: null },
		level: { type: Number, default: 1, min: 1, max: 200 },
		xp: { type: Number, default: 0 },
		prestige: { type: Number, default: 0 },
		skillPoints: { type: Number, default: 0 },

		// Core
		stats: { type: StatSchema, default: () => ({}) },
		skills: { type: [SkillSchema], default: [] },
		equipment: { type: EquipmentSchema, default: () => ({}) },
		inventory: { type: [InventorySchema], default: [] },
		currency: { type: CurrencySchema, default: () => ({}) },

		// Combat session (ephemeral — cleared after fight ends)
		statusEffects: { type: [StatusEffectSchema], default: [] },
		buffs: { type: [BuffSchema], default: [] },

		// Meta
		combatStats: { type: CombatStatsSchema, default: () => ({}) },
		factionId: { type: Schema.Types.ObjectId, ref: "Faction", default: null },
		stamina: { type: Number, default: 120, max: 120 },
		lastStaminaRegen: { type: Date, default: Date.now },

		// Daily
		activeQuests: { type: [QuestSchema], default: [] },
		completedAchievements: { type: [String], default: [] },
		dailyStreak: { type: Number, default: 0 },
		lastDaily: { type: Date, default: null },

		// Gacha
		gacha: {
			totalPulls: { type: Number, default: 0 },
			pityCounter: { type: Number, default: 0 },
			weaponPity: { type: Number, default: 0 },
		},

		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true },
);

// ─── Compound index — one character per user per guild ──────────────────────
CharacterSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// ─── Virtuals ───────────────────────────────────────────────────────────────

/** XP required to reach next level */
CharacterSchema.virtual("xpRequired").get(function () {
	return Math.floor(100 * Math.pow(this.level, 2));
});

/** Is the character alive? */
CharacterSchema.virtual("isAlive").get(function () {
	return this.stats.hp > 0;
});

// ─── Statics ────────────────────────────────────────────────────────────────

/**
 * Find a character for a user in a specific guild, throws-friendly.
 * @returns {Promise<CharacterDocument|null>}
 */
CharacterSchema.statics.findCharacter = function (userId, guildId) {
	return this.findOne({ userId, guildId });
};

// ─── Methods ────────────────────────────────────────────────────────────────

/** Award XP, handle level-ups, return { leveled, newLevel } */
CharacterSchema.methods.awardXP = function (amount) {
	this.xp += amount;
	let leveled = false;
	while (this.xp >= Math.floor(100 * Math.pow(this.level, 2)) && this.level < 200) {
		this.xp -= Math.floor(100 * Math.pow(this.level, 2));
		this.level++;
		this.skillPoints++;
		this._applyLevelStatGrowth();
		leveled = true;
	}
	return { leveled, newLevel: this.level };
};

/** Apply per-level stat growth */
CharacterSchema.methods._applyLevelStatGrowth = function () {
	this.stats.maxHp += 10;
	this.stats.hp = this.stats.maxHp;
	this.stats.maxMp += 5;
	this.stats.mp = this.stats.maxMp;
	this.stats.atk += 2;
	this.stats.def += 1;
	this.stats.matk += 2;
	this.stats.mdef += 1;
	this.stats.spd += 0.5;
};

/** Restore HP/MP up to max. Returns { hpRestored, mpRestored } */
CharacterSchema.methods.restore = function (hpAmt = 0, mpAmt = 0) {
	const hpBefore = this.stats.hp;
	const mpBefore = this.stats.mp;
	this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + hpAmt);
	this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + mpAmt);
	return {
		hpRestored: this.stats.hp - hpBefore,
		mpRestored: this.stats.mp - mpBefore,
	};
};

/** Deduct stamina. Returns false if not enough. */
CharacterSchema.methods.useStamina = function (amount) {
	this._regenStamina();
	if (this.stamina < amount) return false;
	this.stamina -= amount;
	return true;
};

/** Passive stamina regeneration (1 per 5 min) */
CharacterSchema.methods._regenStamina = function () {
	const now = Date.now();
	const elapsed = (now - new Date(this.lastStaminaRegen).getTime()) / 1000 / 60;
	const ticks = Math.floor(elapsed / 5);
	if (ticks > 0 && this.stamina < 120) {
		this.stamina = Math.min(120, this.stamina + ticks);
		this.lastStaminaRegen = new Date(now - (elapsed % 5) * 60 * 1000);
	}
};

module.exports = models.Character || model("Character", CharacterSchema);
