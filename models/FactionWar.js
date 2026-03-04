// models/FactionWar.js

const { Schema, model, models } = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const RelayBattleSchema = new Schema({
  roundNumber:  { type: Number, required: true },
  attackerId:   { type: String, required: true },
  attackerName: { type: String, required: true },
  defenderId:   { type: String, required: true },
  defenderName: { type: String, required: true },
  attackerFaction: { type: String, required: true }, // "alpha" | "beta"
  damageDealt:  { type: Number, default: 0 },
  result:       { type: String, enum: ["win","loss","draw"], default: "draw" },
  log:          { type: [String], default: [] },
  completedAt:  { type: Date, default: null },
}, { _id: false });

const WarTeamSchema = new Schema({
  factionId:   { type: Schema.Types.ObjectId, ref: "Faction", required: true },
  factionName: { type: String, required: true },
  factionTag:  { type: String, required: true },
  color:       { type: Number, default: 0x2980B9 },

  // 5-player roster for relay battle
  roster: [{
    userId:     { type: String, required: true },
    name:       { type: String, required: true },
    class:      { type: String, required: true },
    level:      { type: Number, required: true },
    position:   { type: Number, required: true }, // 1–5 battle order
    hp:         { type: Number, default: 0 },
    maxHp:      { type: Number, default: 0 },
    ready:      { type: Boolean, default: false },
  }],

  // Cumulative score
  score:         { type: Number, default: 0 },
  totalDamage:   { type: Number, default: 0 },

  // Territory being attacked (or defended)
  targetTerritory: { type: String, default: null },
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────

const FactionWarSchema = new Schema({
  guildId:  { type: String, required: true, index: true },

  alpha:    { type: WarTeamSchema, required: true },
  beta:     { type: WarTeamSchema, required: true },

  // War phases: declaration → preparation → relay → siege → resolution
  phase: {
    type: String,
    default: "preparation",
    enum: ["preparation","relay","siege","resolution","ended"],
  },

  // Relay battle state (5v5)
  currentRound:    { type: Number, default: 1 },
  totalRounds:     { type: Number, default: 5 },
  relayBattles:    { type: [RelayBattleSchema], default: [] },
  currentBattle:   { type: RelayBattleSchema, default: null },

  // Territory siege
  siegeTerritory:  { type: String, default: null },
  siegeHp:         { type: Number, default: 10000 },
  siegeMaxHp:      { type: Number, default: 10000 },
  siegeDamageLog:  { type: Map, of: Number, default: {} }, // userId → damage

  // Timing
  preparationEnds: { type: Date, default: null },
  warStartedAt:    { type: Date, default: Date.now },
  warEndsAt:       { type: Date, default: null },

  // Result
  winnerId:        { type: Schema.Types.ObjectId, ref: "Faction", default: null },
  winnerName:      { type: String, default: null },
  alphaScore:      { type: Number, default: 0 },
  betaScore:       { type: Number, default: 0 },

  // Discord
  channelId:       { type: String, default: null },
  messageId:       { type: String, default: null },

  active:          { type: Boolean, default: true },
}, { timestamps: true });

FactionWarSchema.index({ guildId: 1, active: 1 });
FactionWarSchema.index({ "alpha.factionId": 1, active: 1 });
FactionWarSchema.index({ "beta.factionId": 1, active: 1 });

// ─── Methods ──────────────────────────────────────────────────────────────────

FactionWarSchema.methods.getTeam = function (factionId) {
  const id = factionId.toString();
  if (this.alpha.factionId.toString() === id) return { team: this.alpha, side: "alpha" };
  if (this.beta.factionId.toString()  === id) return { team: this.beta,  side: "beta"  };
  return { team: null, side: null };
};

FactionWarSchema.methods.getOpponentTeam = function (factionId) {
  const id = factionId.toString();
  if (this.alpha.factionId.toString() === id) return { team: this.beta,  side: "beta"  };
  if (this.beta.factionId.toString()  === id) return { team: this.alpha, side: "alpha" };
  return { team: null, side: null };
};

FactionWarSchema.methods.isPlayerInWar = function (userId) {
  return this.alpha.roster.some(p => p.userId === userId) ||
         this.beta.roster.some(p => p.userId === userId);
};

FactionWarSchema.methods.currentAttacker = function () {
  // In relay: alpha attacks odd rounds, beta attacks even rounds
  return this.currentRound % 2 === 1 ? "alpha" : "beta";
};

FactionWarSchema.methods.awardScore = function (side, points) {
  if (side === "alpha") {
    this.alpha.score += points;
    this.alphaScore  += points;
  } else {
    this.beta.score  += points;
    this.betaScore   += points;
  }
};

FactionWarSchema.methods.determineWinner = function () {
  if (this.alphaScore > this.betaScore) return { winner: "alpha", team: this.alpha };
  if (this.betaScore  > this.alphaScore) return { winner: "beta",  team: this.beta  };
  return { winner: "draw", team: null };
};

module.exports = models.FactionWar || model("FactionWar", FactionWarSchema);
