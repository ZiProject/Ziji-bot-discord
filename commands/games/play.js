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

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const animals = require("../../data/animals.json");
const { updateQuestProgress } = require("./quests.js");

const PLAY_COOLDOWN = 6 * 60 * 60 * 1000; // 6 hours
const HAPPINESS_GAIN = 15; // Happiness gained from playing
const XP_REWARD = 20; // XP reward for playing
const ZIGOLD_REWARD = 30; // ZiGold reward for playing

const playEmoji = "🎾"; // Play emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const happinessEmoji = "💖"; // Happiness emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const petEmoji = "🐾"; // Pet emoji
const clockEmoji = "⏰"; // Clock emoji
const gameEmoji = "🎮"; // Game emoji

// Play activities with different effects
const PLAY_ACTIVITIES = [
	{
		name: "Ném bóng",
		emoji: "🎾",
		happiness: 15,
		xp: 20,
		zigold: 30,
		messages: [
			"đang chạy theo quả bóng một cách háo hức!",
			"đã bắt được quả bóng và mang về cho bạn!",
			"nhảy lên cao để bắt quả bóng!",
			"chạy vòng quanh với quả bóng trong miệng!",
		],
	},
	{
		name: "Chơi đùa",
		emoji: "🤸",
		happiness: 12,
		xp: 15,
		zigold: 25,
		messages: [
			"đang lăn lộn trên sàn một cách vui vẻ!",
			"nhảy lên nhảy xuống rất hào hứng!",
			"chạy quanh quanh bạn với vẻ vui tươi!",
			"làm những động tác đáng yêu để gây chú ý!",
		],
	},
	{
		name: "Tìm kiếm",
		emoji: "🔍",
		happiness: 18,
		xp: 25,
		zigold: 40,
		messages: [
			"đang ngửi tìm kiếm khắp nơi!",
			"đã tìm thấy thứ gì đó thú vị!",
			"dùng mũi khám phá mọi ngóc ngách!",
			"tìm được một kho báu nhỏ và mang về cho bạn!",
		],
	},
	{
		name: "Âu yếm",
		emoji: "🤗",
		happiness: 20,
		xp: 10,
		zigold: 20,
		messages: [
			"đang nằm trong lòng bạn thật ấm áp!",
			"cọ sát vào bạn một cách âu yếm!",
			"để bạn vuốt ve và tỏ ra rất hạnh phúc!",
			"ngủ gật trong lòng bạn rất yên bình!",
		],
	},
];

module.exports.data = {
	name: "petplay",
	description: "Chơi với thú cưng để tăng happiness và nhận rewards!",
	type: 1,
	options: [],
	integration_types: [0, 1], // Guild app + User app
	contexts: [0, 1, 2], // Guild + DM + Private channels
	dm_permission: true,
	nsfw: false,
};

module.exports.execute = async ({ interaction, lang }) => {
	try {
		const ZiRank = this.functions?.get("ZiRank");
		const DataBase = this.db;

		// Check if database and functions are properly initialized
		if (!DataBase || !DataBase.ZiUser || !ZiRank) {
			return await handleInitializationError(interaction, !DataBase);
		}

		const userId = interaction.user.id;
		const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
		const currentTime = new Date();

		// Get user data
		const userDB = await DataBase.ZiUser.findOne({ userID: userId });

		if (!userDB) {
			return await showNoAnimalsError(interaction);
		}

		// Check if user has any animals
		if (!userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
			return await showNoAnimalsError(interaction);
		}

		// Check cooldown
		const lastPlay = userDB.petCare?.lastPlay ? new Date(userDB.petCare.lastPlay) : null;
		if (lastPlay) {
			const timeSinceLastPlay = currentTime - lastPlay;
			if (timeSinceLastPlay < PLAY_COOLDOWN) {
				const hoursLeft = Math.ceil((PLAY_COOLDOWN - timeSinceLastPlay) / (1000 * 60 * 60));
				return await showPlayCooldown(interaction, hoursLeft);
			}
		}

		// Calculate current happiness (decreases over time)
		const currentHappiness = calculateCurrentHappiness(userDB.petCare);

		// Get random animal from collection for playing
		const randomAnimal = getRandomOwnedAnimal(userDB.huntStats);

		// Get random play activity
		const randomActivity = PLAY_ACTIVITIES[Math.floor(Math.random() * PLAY_ACTIVITIES.length)];

		// Calculate happiness based on animal rarity (higher rarity = more happiness)
		const rarityMultiplier = getRarityMultiplier(randomAnimal.rarity);
		const finalHappiness = Math.floor(randomActivity.happiness * rarityMultiplier);
		const finalXP = Math.floor(randomActivity.xp * rarityMultiplier);
		const finalZigold = Math.floor(randomActivity.zigold * rarityMultiplier);

		// Calculate new happiness (max 100)
		const newHappiness = Math.min(100, currentHappiness + finalHappiness);

		// Update database
		await DataBase.ZiUser.updateOne(
			{ userID: userId },
			{
				$set: {
					"petCare.lastPlay": currentTime,
					"petCare.happiness": newHappiness,
				},
				$inc: {
					"petCare.totalPlays": 1,
					coin: finalZigold,
				},
			},
		);

		// Update quest progress for playing
		await updateQuestProgress(DataBase, userId, "play", 1);

		// Give XP
		await ZiRank.execute({
			user: interaction.user,
			XpADD: finalXP,
			CoinADD: 0, // Already added above
		});

		// Show success message
		await showPlaySuccess(
			interaction,
			randomActivity,
			randomAnimal,
			currentHappiness,
			newHappiness,
			finalHappiness,
			finalXP,
			finalZigold,
			userName,
		);
	} catch (error) {
		console.error("Error in play command:", error);
		await handleCommandError(interaction, error);
	}
};

function calculateCurrentHappiness(petCare) {
	if (!petCare || (!petCare.lastFeed && !petCare.lastPlay)) {
		return petCare?.happiness || 100;
	}

	const lastActivity = Math.max(
		petCare.lastFeed ? new Date(petCare.lastFeed).getTime() : 0,
		petCare.lastPlay ? new Date(petCare.lastPlay).getTime() : 0,
	);

	const currentTime = new Date();
	const hoursSinceLastActivity = (currentTime - lastActivity) / (1000 * 60 * 60);

	// Happiness decreases by 1.5 per hour, minimum 0
	const happinessDecay = Math.floor(hoursSinceLastActivity * 1.5);
	const currentHappiness = Math.max(0, (petCare.happiness || 100) - happinessDecay);

	return currentHappiness;
}

function getRandomOwnedAnimal(huntStats) {
	const allAnimals = [];

	// Collect all owned animals with weights based on count
	for (const [rarity, animalData] of Object.entries(huntStats)) {
		if (animals[rarity]) {
			for (const [animalName, data] of Object.entries(animalData)) {
				if (data && data.count > 0) {
					const animalInfo = animals[rarity].find((a) => a.name === animalName);
					if (animalInfo) {
						// Add animal multiple times based on count (higher chance for more animals)
						for (let i = 0; i < Math.min(data.count, 5); i++) {
							allAnimals.push({
								...animalInfo,
								rarity: rarity,
								count: data.count,
							});
						}
					}
				}
			}
		}
	}

	if (allAnimals.length === 0) {
		return { name: "thú cưng", emoji: "🐾", rarity: "common" };
	}

	// Pick random animal
	return allAnimals[Math.floor(Math.random() * allAnimals.length)];
}

function getRarityMultiplier(rarity) {
	const multipliers = {
		common: 1.0,
		uncommon: 1.2,
		rare: 1.4,
		epic: 1.6,
		legendary: 2.0,
	};

	return multipliers[rarity] || 1.0;
}

async function showNoAnimalsError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle(`${petEmoji} Không có thú cưng`)
		.setColor("#FF6B6B")
		.setDescription(
			`🔍 **Bạn chưa có thú cưng nào để chơi cùng!**\n\n🏹 Hãy dùng lệnh \`\`\`text\n/hunt\n\`\`\` để bắt thú cưng đầu tiên của bạn!\n\n${sparkleEmoji} Sau khi có thú cưng, bạn có thể chơi với chúng để tăng happiness và nhận rewards!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Sử dụng /hunt để bắt đầu collection của bạn!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showPlayCooldown(interaction, hoursLeft) {
	const embed = new EmbedBuilder()
		.setTitle(`${clockEmoji} Play Cooldown`)
		.setColor("#FFD700")
		.setDescription(
			`⏳ **Thú cưng của bạn cần nghỉ ngơi!**\n\n${playEmoji} **Thời gian còn lại:** ${hoursLeft} giờ\n\n💤 Thú cưng cần thời gian để hồi phục trước khi chơi tiếp!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `Quay lại sau ${hoursLeft} giờ để chơi tiếp!`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showPlaySuccess(
	interaction,
	activity,
	animal,
	oldHappiness,
	newHappiness,
	happinessGain,
	xpGain,
	zigoldGain,
	userName,
) {
	const happinessBar = getHappinessBar(newHappiness);
	const randomMessage = activity.messages[Math.floor(Math.random() * activity.messages.length)];

	let description = `${sparkleEmoji} **Chơi với thú cưng thành công!**\n\n`;
	description += `${activity.emoji} **${activity.name}:**\n`;
	description += `${animal.emoji} **${animal.name}** ${randomMessage}\n\n`;
	description += `${happinessEmoji} **+${happinessGain} Happiness** (${oldHappiness} → ${newHappiness})\n`;
	description += `✨ **+${xpGain} XP**\n`;
	description += `${zigoldEmoji} **+${zigoldGain} ZiGold**\n\n`;
	description += `${happinessEmoji} **Happiness:** ${happinessBar} ${newHappiness}/100\n`;

	// Add rarity bonus message
	if (animal.rarity !== "common") {
		description += `\n🌟 **Rarity Bonus:** ${animal.rarity} animal cho thêm rewards!`;
	}

	// Add happiness status message
	if (newHappiness >= 90) {
		description += `\n🥰 **Thú cưng của bạn cực kỳ hạnh phúc!**`;
	} else if (newHappiness >= 70) {
		description += `\n😊 **Thú cưng của bạn rất vui vẻ!**`;
	} else if (newHappiness <= 30) {
		description += `\n😢 **Thú cưng cần được chăm sóc thêm!**`;
	}

	const embed = new EmbedBuilder()
		.setTitle(`${gameEmoji} Pet Playing - ${userName}`)
		.setColor(
			newHappiness >= 80 ? "#00FF00"
			: newHappiness >= 50 ? "#FFD700"
			: "#FF6B6B",
		)
		.setDescription(description)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `${animal.name} đã có khoảng thời gian vui vẻ! • Quay lại sau 6 giờ để chơi tiếp!`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

function getHappinessBar(happiness) {
	const bars = Math.floor(happiness / 10);
	const fullBars = "💖".repeat(bars);
	const emptyBars = "💔".repeat(10 - bars);
	return fullBars + emptyBars;
}

async function handleInitializationError(interaction, isDatabaseError) {
	const errorEmbed = new EmbedBuilder()
		.setTitle(`⚠️ ${sparkleEmoji} Khởi tạo hệ thống`)
		.setColor("#FFD700")
		.setDescription(
			isDatabaseError ?
				"🔄 **Đang khởi tạo database...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!"
			:	"🔄 **Đang khởi tạo functions...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!",
		)
		.setThumbnail(interaction.client.user.displayAvatarURL({ size: 1024 }))
		.setFooter({
			text: "Hệ thống đang được khởi tạo, vui lòng thử lại sau ít phút!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	if (interaction.replied || interaction.deferred) {
		return await interaction.editReply({ embeds: [errorEmbed] });
	} else {
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}

async function handleCommandError(interaction, error) {
	console.error("Play command error:", error);
	const errorEmbed = new EmbedBuilder()
		.setTitle("❌ Lỗi")
		.setColor("#FF0000")
		.setDescription("Có lỗi xảy ra khi chơi với thú cưng. Vui lòng thử lại!");

	if (interaction.replied || interaction.deferred) {
		return await interaction.editReply({ embeds: [errorEmbed] });
	} else {
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}
