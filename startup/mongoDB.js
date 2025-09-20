const { Schema, model } = require("mongoose");

const ZiUser = Schema({
        userID: { type: String },
        name: { type: String },
        xp: { type: Number },
        level: { type: Number, default: 1 },
        coin: { type: Number, default: 0 },
        lang: { type: String },
        volume: { type: Number, default: 100 },
        color: { type: String, default: "Random" },
        lastDaily: { type: Date },
        dailyStreak: { type: Number, default: 0 },
        lastHunt: { type: Date },
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
                favoriteAnimal: { type: String, default: null }
        },
        // Animal trading system
        lastGive: { type: Date },
        dailyGives: { type: Number, default: 0 },
        // Quest system
        dailyQuests: { type: Array, default: [] },
        lastQuestReset: { type: Date },
});

const ZiAutoresponder = Schema(
        {
                guildId: { type: String, required: true },
                trigger: { type: String, required: true },
                response: { type: String, required: true },
                options: {
                        matchMode: { type: String, enum: ["exactly", "startswith", "endswith", "includes"], default: "exactly" },
                },
        },
        {
                timestamps: true,
        },
);

const ZiWelcome = Schema(
        {
                guildId: { type: String, required: true },
                channel: { type: String, required: true },
                content: { type: String, required: true },
                Bchannel: { type: String, required: true },
                Bcontent: { type: String }, // Corrected duplicate
        },
        {
                timestamps: true,
        },
);

const ZiGuild = Schema({
        guildId: { type: String, required: true },
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
                                channelId: String,
                                ownerId: String,
                                locked: { type: Boolean, default: false },
                        },
                ],
                blockedUser: [String],
        },
});

const ZiConfess = Schema({
        enabled: { type: Boolean, default: false },
        guildId: { type: String, required: true },
        channelId: { type: String, required: true },
        reviewSystem: { type: Boolean, default: false },
        reviewChannelId: { type: String, required: false, default: null },
        currentId: { type: Number, default: 0 },
        confessions: [
                {
                        id: { type: Number },
                        content: { type: String },
                        author: { type: Object },
                        type: { type: String, enum: ["anonymous", "public"] },
                        status: { type: String, enum: ["pending", "rejected", "approved"], default: "approved" },
                        messageId: { type: String, default: null },
                        threadId: { type: String, default: null },
                        reviewMessageId: { type: String, default: null },
                },
        ],
});

module.exports = {
        ZiUser: model("ZiUser", ZiUser),
        ZiAutoresponder: model("ZiAutoresponder", ZiAutoresponder),
        ZiWelcome: model("ZiWelcome", ZiWelcome),
        ZiGuild: model("ZiGuild", ZiGuild),
        ZiConfess: model("ZiConfess", ZiConfess),
};
