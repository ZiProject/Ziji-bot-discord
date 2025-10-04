/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { Schema, model } = require("mongoose");

const ZiUser = Schema({
	userID: { type: String, required: true, index: true },
	name: { type: String, index: true },
	xp: { type: Number, default: 0, index: true },
	level: { type: Number, default: 1, index: true },
	coin: { type: Number, default: 0, index: true },
	lang: { type: String, default: "vi" },
	volume: { type: Number, default: 100 },
	color: { type: String, default: "Random" },
	lastDaily: { type: Date, index: true },
	dailyStreak: { type: Number, default: 0 },
	lastHunt: { type: Date, index: true },
	totalAnimals: { type: Number, default: 0 },
	huntStats: { type: Schema.Types.Mixed, default: {} },
	lootboxes: { type: Number, default: 0 },
	fabledLootboxes: { type: Number, default: 0 },
	cookiesGiven: { type: Number, default: 0 },
	cookiesReceived: { type: Number, default: 0 },
	lastCookie: { type: Date },
	thankedCookies: { type: [String], default: [] },
	// Pet care system
	petCare: {
		lastFeed: { type: Date },
		lastPlay: { type: Date },
		happiness: { type: Number, default: 100 },
		totalFeedings: { type: Number, default: 0 },
		totalPlays: { type: Number, default: 0 },
		favoriteAnimal: { type: String, default: null },
	},
	// Animal trading system
	lastGive: { type: Date },
	dailyGives: { type: Number, default: 0 },
	// Quest system
	dailyQuests: { type: Array, default: [] },
	lastQuestReset: { type: Date },
}, {
	timestamps: true,
	// Optimize for read operations
	read: 'secondaryPreferred'
});

const ZiAutoresponder = Schema(
	{
		guildId: { type: String, required: true, index: true },
		trigger: { type: String, required: true, index: true },
		response: { type: String, required: true },
		options: {
			matchMode: { type: String, enum: ["exactly", "startswith", "endswith", "includes"], default: "exactly" },
		},
	},
	{
		timestamps: true,
		read: 'secondaryPreferred'
	},
);

const ZiWelcome = Schema(
	{
		guildId: { type: String, required: true, index: true },
		channel: { type: String, required: true },
		content: { type: String, required: true },
		Bchannel: { type: String, required: true },
		Bcontent: { type: String },
	},
	{
		timestamps: true,
		read: 'secondaryPreferred'
	},
);

const ZiGuild = Schema({
	guildId: { type: String, required: true, index: true },
	voice: {
		logMode: { type: Boolean, default: false },
	},
	joinToCreate: {
		enabled: { type: Boolean, default: false },
		voiceChannelId: { type: String, default: null },
		categoryId: { type: String, default: null },
		defaultUserLimit: { type: Number, default: 0 },
		tempChannels: [
			{
				channelId: { type: String, index: true },
				ownerId: { type: String, index: true },
				locked: { type: Boolean, default: false },
			},
		],
		blockedUser: [String],
	},
}, {
	timestamps: true,
	read: 'secondaryPreferred'
});

const ZiConfess = Schema({
	enabled: { type: Boolean, default: false },
	guildId: { type: String, required: true, index: true },
	channelId: { type: String, required: true },
	reviewSystem: { type: Boolean, default: false },
	reviewChannelId: { type: String, default: null },
	currentId: { type: Number, default: 0 },
	confessions: [
		{
			id: { type: Number, index: true },
			content: { type: String },
			author: { type: Object },
			type: { type: String, enum: ["anonymous", "public"] },
			status: { type: String, enum: ["pending", "rejected", "approved"], default: "approved", index: true },
			messageId: { type: String, default: null },
			threadId: { type: String, default: null },
			reviewMessageId: { type: String, default: null },
		},
	],
}, {
	timestamps: true,
	read: 'secondaryPreferred'
});

module.exports = {
	ZiUser: model("ZiUser", ZiUser),
	ZiAutoresponder: model("ZiAutoresponder", ZiAutoresponder),
	ZiWelcome: model("ZiWelcome", ZiWelcome),
	ZiGuild: model("ZiGuild", ZiGuild),
	ZiConfess: model("ZiConfess", ZiConfess),
};
