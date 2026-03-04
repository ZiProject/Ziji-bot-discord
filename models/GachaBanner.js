// models/GachaBanner.js
// Stores active & historical banner configurations.

const { Schema, model, models } = require("mongoose");

const RateOverrideSchema = new Schema({
  rarity:     { type: String, required: true }, // "legendary","epic",etc.
  baseRate:   { type: Number, required: true }, // 0.006 = 0.6%
  softPityAt: { type: Number, default: null },  // pull number where soft pity starts
  softPityInc:{ type: Number, default: 0 },     // rate added per pull after soft pity
  hardPityAt: { type: Number, default: null },  // guaranteed at this pull
}, { _id: false });

const FeaturedItemSchema = new Schema({
  itemId:   { type: String, required: true },
  name:     { type: String, required: true },
  rarity:   { type: String, required: true },
  emoji:    { type: String, default: "✨" },
  isRateUp: { type: Boolean, default: true },  // 50/50 rate-up item
}, { _id: false });

const GachaBannerSchema = new Schema({
  // Identity
  bannerId:    { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  type:        { type: String, required: true, enum: ["standard","character","weapon","beginner","faction","collab"] },
  emoji:       { type: String, default: "🎰" },
  description: { type: String, default: "" },
  color:       { type: Number, default: 0x9B59B6 },

  // Cost
  gemCost:      { type: Number, default: 300 },  // per single pull
  tenPullCost:  { type: Number, default: 2700 }, // 10% discount

  // Items
  featuredItems: { type: [FeaturedItemSchema], default: [] },
  itemPool:      { type: [String], default: [] }, // all possible itemIds

  // Rates (overrides global defaults)
  rateOverrides: { type: [RateOverrideSchema], default: [] },

  // Pity config
  hardPity:      { type: Number, default: 90 },  // guaranteed legendary at this pull
  softPityStart: { type: Number, default: 75 },  // soft pity begins
  softPityInc:   { type: Number, default: 0.06 },// +6% per pull after soft pity
  weaponHardPity:{ type: Number, default: 80 },  // weapon banner specific

  // Lifecycle
  active:    { type: Boolean, default: true },
  startDate: { type: Date, default: Date.now },
  endDate:   { type: Date, default: null },

  // Stats
  totalPulls: { type: Number, default: 0 },
}, { timestamps: true });

GachaBannerSchema.index({ active: 1 });
GachaBannerSchema.index({ bannerId: 1 }, { unique: true });

module.exports = models.GachaBanner || model("GachaBanner", GachaBannerSchema);
