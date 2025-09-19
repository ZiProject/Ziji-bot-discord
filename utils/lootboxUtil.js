const animals = require("../data/animals.json");

// Lootbox reward generation utility
class LootboxUtil {
    constructor() {
        this.ranks = animals.ranks;
        
        // Define reward types based on ranks
        this.rewardTypes = {
            essence: { name: "Essence", emoji: "⚡" },
            points: { name: "Points", emoji: "🔮" },
            zigold: { name: "ZiGold", emoji: "🪙" },
            xp: { name: "XP", emoji: "✨" }
        };
    }

    // Generate random reward for normal lootbox
    generateRandomReward(count = 1) {
        const rewards = [];
        
        for (let i = 0; i < count; i++) {
            const reward = this.generateSingleReward();
            
            // Check if this reward already exists in rewards array
            const existingReward = rewards.find(r => 
                r.rank === reward.rank && r.type === reward.type
            );
            
            if (existingReward) {
                existingReward.count++;
                // Keep unit values - don't accumulate here to avoid double counting
            } else {
                rewards.push({
                    ...reward,
                    count: 1
                });
            }
        }
        
        return { rewards };
    }

    // Generate reward for fabled lootbox (higher tiers only)
    generateFabledReward(count = 1) {
        const rewards = [];
        
        for (let i = 0; i < count; i++) {
            const reward = this.generateSingleFabledReward();
            
            // Check if this reward already exists in rewards array
            const existingReward = rewards.find(r => 
                r.rank === reward.rank && r.type === reward.type
            );
            
            if (existingReward) {
                existingReward.count++;
                // Keep unit values - don't accumulate here to avoid double counting
            } else {
                rewards.push({
                    ...reward,
                    count: 1
                });
            }
        }
        
        return { rewards };
    }

    // Generate single reward based on rank probabilities
    generateSingleReward() {
        const selectedRank = this.selectRandomRank();
        const selectedType = this.selectRandomRewardType();
        
        return this.createReward(selectedRank, selectedType);
    }

    // Generate single fabled reward (higher tiers only)
    generateSingleFabledReward() {
        // Fabled lootboxes only give high-tier rewards
        const fabledRanks = ['legendary', 'fabled', 'hidden', 'mythical', 'gem'];
        const availableRanks = fabledRanks.filter(rank => this.ranks[rank]);
        
        const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
        const selectedType = this.selectRandomRewardType();
        
        return this.createReward(selectedRank, selectedType, true); // isFabled = true for bonus
    }

    // Select random rank based on rarity weights
    selectRandomRank() {
        const rankNames = Object.keys(this.ranks);
        const weights = [];
        
        // Use rarity percentages directly as weights (higher rarity = more common)
        for (const rankName of rankNames) {
            const rank = this.ranks[rankName];
            if (rank.rarity > 0) {
                // Use rarity directly - higher rarity = more likely
                weights.push(rank.rarity);
            } else {
                // Special ranks with 0 rarity get tiny weight but still possible
                weights.push(0.01);
            }
        }
        
        // Weighted random selection
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let randomValue = Math.random() * totalWeight;
        
        for (let i = 0; i < rankNames.length; i++) {
            randomValue -= weights[i];
            if (randomValue <= 0) {
                return rankNames[i];
            }
        }
        
        return rankNames[0]; // Fallback to first rank
    }

    // Select random reward type
    selectRandomRewardType() {
        const types = Object.keys(this.rewardTypes);
        return types[Math.floor(Math.random() * types.length)];
    }

    // Create reward object
    createReward(rankName, rewardType, isFabled = false) {
        const rank = this.ranks[rankName];
        const typeInfo = this.rewardTypes[rewardType];
        
        if (!rank || !typeInfo) {
            // Fallback to common zigold reward
            return this.createReward('common', 'zigold', isFabled);
        }

        // Calculate base reward amount based on rank values
        let baseAmount = 0;
        let xpReward = 0;
        
        switch (rewardType) {
            case 'essence':
                baseAmount = rank.essence || 1;
                break;
            case 'points':
                baseAmount = rank.points || 1;
                break;
            case 'zigold':
                baseAmount = rank.price || 1;
                break;
            case 'xp':
                baseAmount = rank.xp || 1;
                xpReward = baseAmount;
                baseAmount = 0; // XP doesn't convert to ZiGold
                break;
        }

        // Add randomization (±25% of base amount)
        const randomMultiplier = 0.75 + (Math.random() * 0.5); // 0.75 to 1.25
        baseAmount = Math.floor(baseAmount * randomMultiplier);
        
        // Fabled bonus
        if (isFabled) {
            baseAmount = Math.floor(baseAmount * 2.5);
            xpReward = Math.floor(xpReward * 2.5);
        }

        // Ensure minimum values
        if (baseAmount < 1 && rewardType !== 'xp') baseAmount = 1;
        if (xpReward < 1 && rewardType === 'xp') xpReward = 1;

        // Convert non-ZiGold rewards to ZiGold equivalent
        let zigoldReward = baseAmount;
        if (rewardType === 'essence') {
            zigoldReward = Math.floor(baseAmount * 0.8); // Essence worth 80% of ZiGold
        } else if (rewardType === 'points') {
            zigoldReward = Math.floor(baseAmount * 1.2); // Points worth 120% of ZiGold
        } else if (rewardType === 'xp') {
            zigoldReward = Math.floor(xpReward * 10); // XP worth 10 ZiGold per XP
        }

        return {
            rank: rankName,
            type: rewardType,
            emoji: rank.emoji || typeInfo.emoji,
            displayName: `${rank.emoji || typeInfo.emoji} ${this.capitalizeFirst(rankName)} ${typeInfo.name}`,
            amount: Math.max(baseAmount, 1),
            zigoldReward: Math.max(zigoldReward, 1),
            xpReward: xpReward,
            isFabled: isFabled
        };
    }

    // Helper function to capitalize first letter
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Get random gems for compatibility with original OwO system
    getRandomGems(uid, count) {
        // This method maintains compatibility with the original OwO structure
        const rewards = this.generateRandomReward(count);
        const gems = {};
        
        for (let i = 0; i < rewards.rewards.length; i++) {
            const reward = rewards.rewards[i];
            const gemKey = `${reward.rank}_${reward.type}`;
            
            gems[gemKey] = {
                gem: {
                    rank: this.capitalizeFirst(reward.rank),
                    type: this.capitalizeFirst(reward.type),
                    emoji: reward.emoji
                },
                count: reward.count
            };
        }

        // Generate SQL for compatibility (though we use MongoDB)
        let sql = '';
        for (const reward of rewards.rewards) {
            sql += `UPDATE ZiUser SET coin = coin + ${reward.zigoldReward * reward.count} WHERE userID = '${uid}'; `;
        }

        return { gems, sql };
    }

    // Get random fabled gems
    getRandomFabledGems(uid, count) {
        const rewards = this.generateFabledReward(count);
        const gems = {};
        
        for (let i = 0; i < rewards.rewards.length; i++) {
            const reward = rewards.rewards[i];
            const gemKey = `${reward.rank}_${reward.type}`;
            
            gems[gemKey] = {
                gem: {
                    rank: this.capitalizeFirst(reward.rank),
                    type: this.capitalizeFirst(reward.type),
                    emoji: reward.emoji
                },
                count: reward.count
            };
        }

        // Generate SQL for compatibility (though we use MongoDB)
        let sql = '';
        for (const reward of rewards.rewards) {
            sql += `UPDATE ZiUser SET coin = coin + ${reward.zigoldReward * reward.count} WHERE userID = '${uid}'; `;
        }

        return { gems, sql };
    }
}

// Export instance
module.exports = new LootboxUtil();