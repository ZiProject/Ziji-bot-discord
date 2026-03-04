// models/Faction.js

const { Schema, model, models } = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const MemberSchema = new Schema({
  userId:        { type: String, required: true },
  rank:          { type: String, default: "member", enum: ["leader","officer","elite","member"] },
  contribution:  { type: Number, default: 0 },   // faction tokens donated
  warContrib:    { type: Number, default: 0 },   // damage dealt in wars
  joinedAt:      { type: Date, default: Date.now },
}, { _id: false });

const TerritorySchema = new Schema({
  territoryId:  { type: String, required: true },
  name:         { type: String, required: true },
  type:         { type: String, required: true, enum: ["mine","fortress","shrine","market","dungeon_gate"] },
  bonusType:    { type: String, required: true },
  bonusValue:   { type: Number, required: true },
  capturedAt:   { type: Date, default: Date.now },
  defenseScore: { type: Number, default: 0 },
}, { _id: false });

const HallUpgradeSchema = new Schema({
  upgradeId:  { type: String, required: true },
  name:       { type: String, required: true },
  level:      { type: Number, default: 1, max: 10 },
  effect:     { type: String, default: "" },
}, { _id: false });

const WarRecordSchema = new Schema({
  opponent:    { type: Schema.Types.ObjectId, ref: "Faction" },
  opponentName:{ type: String },
  result:      { type: String, enum: ["win","loss","draw"] },
  score:       { type: Number, default: 0 },
  oppScore:    { type: Number, default: 0 },
  date:        { type: Date, default: Date.now },
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────

const FactionSchema = new Schema({
  guildId:     { type: String, required: true, index: true },
  name:        { type: String, required: true, maxlength: 32 },
  tag:         { type: String, required: true, maxlength: 5, uppercase: true },
  emoji:       { type: String, default: "⚔️" },
  description: { type: String, default: "", maxlength: 256 },
  color:       { type: Number, default: 0x2980B9 },
  banner:      { type: String, default: null },

  leaderId:    { type: String, required: true },
  members:     { type: [MemberSchema], default: [] },
  maxMembers:  { type: Number, default: 30 },

  // Resources
  factionGold:   { type: Number, default: 0 },
  factionTokens: { type: Number, default: 0 },

  // Power score — recalculated periodically
  powerScore: { type: Number, default: 0 },
  level:      { type: Number, default: 1, max: 20 },
  xp:         { type: Number, default: 0 },

  // Territory
  territories: { type: [TerritorySchema], default: [] },

  // Faction Hall upgrades
  hallUpgrades: { type: [HallUpgradeSchema], default: [] },

  // War state
  warStatus:    { type: String, default: "idle", enum: ["idle","searching","in_war","cooldown"] },
  currentWarId: { type: Schema.Types.ObjectId, ref: "FactionWar", default: null },
  warRecord:    { type: [WarRecordSchema], default: [] },
  warWins:      { type: Number, default: 0 },
  warLosses:    { type: Number, default: 0 },

  // Cooldown after war ends
  warCooldownUntil: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

FactionSchema.index({ guildId: 1, tag: 1 }, { unique: true });
FactionSchema.index({ guildId: 1, powerScore: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

FactionSchema.virtual("memberCount").get(function () {
  return this.members.length;
});

FactionSchema.virtual("isInWar").get(function () {
  return this.warStatus === "in_war";
});

// ─── Methods ──────────────────────────────────────────────────────────────────

FactionSchema.methods.getMember = function (userId) {
  return this.members.find(m => m.userId === userId) ?? null;
};

FactionSchema.methods.isMember = function (userId) {
  return this.members.some(m => m.userId === userId);
};

FactionSchema.methods.isLeaderOrOfficer = function (userId) {
  const m = this.getMember(userId);
  return m && (m.rank === "leader" || m.rank === "officer");
};

/** Recalculate power score from member levels and territory count */
FactionSchema.methods.recalculatePower = function (memberChars) {
  const avgLevel  = memberChars.length
    ? memberChars.reduce((s, c) => s + c.level, 0) / memberChars.length
    : 0;
  const terrBonus = this.territories.length * 50;
  const hallBonus = this.hallUpgrades.reduce((s, u) => s + u.level * 10, 0);
  this.powerScore = Math.floor(avgLevel * 10 + terrBonus + hallBonus);
};

/** Get total bonus from a territory type */
FactionSchema.methods.getTerritoryBonus = function (bonusType) {
  return this.territories
    .filter(t => t.bonusType === bonusType)
    .reduce((s, t) => s + t.bonusValue, 0);
};

/** Get upgrade level by id */
FactionSchema.methods.getUpgradeLevel = function (upgradeId) {
  return this.hallUpgrades.find(u => u.upgradeId === upgradeId)?.level ?? 0;
};

/** Award faction XP and handle level-up */
FactionSchema.methods.awardFactionXP = function (amount) {
  this.xp += amount;
  let leveled = false;
  const xpRequired = () => Math.floor(500 * Math.pow(this.level, 1.5));
  while (this.xp >= xpRequired() && this.level < 20) {
    this.xp -= xpRequired();
    this.level++;
    this.maxMembers = 30 + (this.level - 1) * 2; // +2 slots per level
    leveled = true;
  }
  return leveled;
};

module.exports = models.Faction || model("Faction", FactionSchema);
