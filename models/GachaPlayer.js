// models/GachaPlayer.js
// Per-user gacha state: pity counters, pull history, owned summon items.

const { Schema, model, models } = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const PityStateSchema = new Schema({
  bannerId:        { type: String, required: true },
  pullCount:       { type: Number, default: 0 },   // total pulls on this banner
  pityCounter:     { type: Number, default: 0 },   // pulls since last legendary
  epicPityCounter: { type: Number, default: 0 },   // pulls since last epic
  guaranteedRateUp:{ type: Boolean, default: false }, // 50/50 failed last time → guaranteed
  beginnerPulls:   { type: Number, default: 0 },   // tracks beginner banner limit
}, { _id: false });

const PullRecordSchema = new Schema({
  bannerId:  { type: String, required: true },
  itemId:    { type: String, required: true },
  itemName:  { type: String, required: true },
  rarity:    { type: String, required: true },
  emoji:     { type: String, default: "✨" },
  wasPity:   { type: Boolean, default: false },    // triggered hard/soft pity
  wasRateUp: { type: Boolean, default: false },    // got the rate-up item
  pulledAt:  { type: Date,   default: Date.now },
}, { _id: false });

const OwnedSummonSchema = new Schema({
  itemId:     { type: String, required: true },
  itemName:   { type: String, required: true },
  rarity:     { type: String, required: true },
  emoji:      { type: String, default: "✨" },
  count:      { type: Number, default: 1 },        // dupe count
  stardust:   { type: Number, default: 0 },        // accumulated from dupes
  firstPulled:{ type: Date, default: Date.now },
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────
const GachaPlayerSchema = new Schema({
  userId:   { type: String, required: true, index: true },
  guildId:  { type: String, required: true, index: true },

  // Per-banner pity tracking
  pityStates: { type: [PityStateSchema], default: [] },

  // Global pull history (last 200 kept)
  pullHistory: { type: [PullRecordSchema], default: [] },

  // Owned gacha items (heroes/weapons obtained from pulls)
  ownedItems: { type: [OwnedSummonSchema], default: [] },

  // Stardust balance (from dupes)
  stardust: { type: Number, default: 0 },

  // Lifetime stats
  totalPulls:      { type: Number, default: 0 },
  totalLegendary:  { type: Number, default: 0 },
  totalEpic:       { type: Number, default: 0 },
  totalSpentGems:  { type: Number, default: 0 },
}, { timestamps: true });

GachaPlayerSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// ─── Methods ──────────────────────────────────────────────────────────────────

/** Get or create pity state for a banner */
GachaPlayerSchema.methods.getPityState = function (bannerId) {
  let state = this.pityStates.find(p => p.bannerId === bannerId);
  if (!state) {
    this.pityStates.push({ bannerId, pullCount: 0, pityCounter: 0, epicPityCounter: 0, guaranteedRateUp: false });
    state = this.pityStates[this.pityStates.length - 1];
  }
  return state;
};

/** Record a pull result */
GachaPlayerSchema.methods.recordPull = function (bannerId, item) {
  // Keep only last 200 in history
  if (this.pullHistory.length >= 200) this.pullHistory.shift();

  this.pullHistory.push({
    bannerId,
    itemId:    item.itemId,
    itemName:  item.name,
    rarity:    item.rarity,
    emoji:     item.emoji ?? "✨",
    wasPity:   item.wasPity ?? false,
    wasRateUp: item.wasRateUp ?? false,
  });

  // Update owned
  const owned = this.ownedItems.find(o => o.itemId === item.itemId);
  if (owned) {
    owned.count++;
    const dustValue = { common:1, uncommon:3, rare:10, epic:25, legendary:50, mythic:100, unique:200 };
    const dust = dustValue[item.rarity] ?? 1;
    owned.stardust += dust;
    this.stardust  += dust;
  } else {
    this.ownedItems.push({ itemId: item.itemId, itemName: item.name, rarity: item.rarity, emoji: item.emoji ?? "✨", count: 1 });
  }

  // Stats
  this.totalPulls++;
  if (item.rarity === "legendary" || item.rarity === "mythic" || item.rarity === "unique") this.totalLegendary++;
  if (item.rarity === "epic") this.totalEpic++;
};

/** Get pull history for a specific banner (last N) */
GachaPlayerSchema.methods.getBannerHistory = function (bannerId, limit = 50) {
  return this.pullHistory
    .filter(p => p.bannerId === bannerId)
    .slice(-limit)
    .reverse();
};

/** Static: find or create player state */
GachaPlayerSchema.statics.findOrCreate = async function (userId, guildId) {
  let player = await this.findOne({ userId, guildId });
  if (!player) player = await this.create({ userId, guildId });
  return player;
};

module.exports = models.GachaPlayer || model("GachaPlayer", GachaPlayerSchema);
