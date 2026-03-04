// functions/rpg/seededRng.js
// Mulberry32 — a fast, high-quality 32-bit seeded pseudo-random number generator.
// Returns floats in [0, 1). No external dependencies.
//
// Usage:
//   const RNG = require("./seededRng");
//   const rng = new RNG(12345);
//   rng.next();         // → 0.7312...
//   rng.nextInt(1, 6);  // → 3  (inclusive both ends)
//   rng.pick(array);    // → random element

class SeededRNG {
  /**
   * @param {number} seed — integer seed
   */
  constructor(seed) {
    this._state = seed >>> 0; // ensure 32-bit unsigned
  }

  /** Returns a float in [0, 1) */
  next() {
    this._state |= 0;
    this._state = this._state + 0x6D2B79F5 | 0;
    let z = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
    z = z + Math.imul(z ^ (z >>> 7), 61 | z) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns an integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random element from an array.
   * @param {any[]} arr
   */
  pick(arr) {
    if (!arr.length) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Returns a shuffled copy of an array (Fisher-Yates).
   * @param {any[]} arr
   */
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Roll a weighted table: [{ item, weight }, ...]
   * Returns the selected item.
   * @param {{ item: any, weight: number }[]} table
   */
  weightedPick(table) {
    const total = table.reduce((s, t) => s + t.weight, 0);
    let roll = this.next() * total;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return table[table.length - 1].item;
  }
}

module.exports = SeededRNG;
