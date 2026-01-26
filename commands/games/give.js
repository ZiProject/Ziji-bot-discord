const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const animals = require("../../data/animals.json");

const GIVE_COOLDOWN = 30 * 1000; // 30 giây giữa các lần tặng
const MAX_GIVE_PER_DAY = 10; // Tối đa 10 lần tặng mỗi ngày

const giveEmoji = "🎁"; // Biểu tượng tặng
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const heartEmoji = "💖"; // Biểu tượng trái tim
const petEmoji = "🐾"; // Biểu tượng thú cưng
const clockEmoji = "⏰"; // Biểu tượng đồng hồ
const arrowEmoji = "➡️"; // Biểu tượng mũi tên

module.exports.data = {
	name: "giveanimal",
	description: "Tặng animals cho người khác từ collection của bạn!",
	type: 1,
	options: [
		{
			type: 6,
			name: "user",
			description: "Người nhận",
			required: true,
		},
		{
			type: 3,
			name: "animal",
			description: "Tên animal muốn tặng",
			required: true,
		},
		{
			type: 4,
			name: "amount",
			description: "Số lượng muốn tặng",
			required: false,
			min_value: 1,
			max_value: 10,
		},
	],
	integration_types: [0, 1], // Ứng dụng máy chủ + Ứng dụng người dùng
	contexts: [0, 1, 2], // Máy chủ + Tin nhắn riêng + Kênh riêng tư
	dm_permission: true,
	nsfw: false,
};

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	try {
		const ZiRank = useHooks.get("functions").get("ZiRank");
		const DataBase = useHooks.get("db");

		// Kiểm tra xem cơ sở dữ liệu và các hàm được khởi tạo đúng cách
		if (!DataBase || !DataBase.ZiUser || !ZiRank) {
			return await handleInitializationError(interaction, !DataBase);
		}

		const giverId = interaction.user.id;
		const receiverUser = interaction.options.getUser("user");
		const animalName = interaction.options.getString("animal").toLowerCase();
		const amount = interaction.options.getInteger("amount") || 1;
		const currentTime = new Date();

		// Kiểm tra xác thực
		if (receiverUser.id === giverId) {
			return await showSelfGiveError(interaction);
		}

		if (receiverUser.bot) {
			return await showBotGiveError(interaction);
		}

		// Lấy dữ liệu của cả hai người dùng
		const [giverDB, receiverDB] = await Promise.all([
			DataBase.ZiUser.findOne({ userID: giverId }),
			DataBase.ZiUser.findOne({ userID: receiverUser.id }),
		]);

		if (!giverDB || !giverDB.huntStats || Object.keys(giverDB.huntStats).length === 0) {
			return await showNoAnimalsError(interaction);
		}

		// Check daily give limit
		const today = new Date().toDateString();
		const lastGiveDate = giverDB.lastGive ? new Date(giverDB.lastGive).toDateString() : null;
		const dailyGives = lastGiveDate === today ? giverDB.dailyGives || 0 : 0;

		if (dailyGives >= MAX_GIVE_PER_DAY) {
			return await showDailyLimitError(interaction);
		}

		// Check cooldown
		const lastGive = giverDB.lastGive ? new Date(giverDB.lastGive) : null;
		if (lastGive && currentTime - lastGive < GIVE_COOLDOWN) {
			const secondsLeft = Math.ceil((GIVE_COOLDOWN - (currentTime - lastGive)) / 1000);
			return await showGiveCooldown(interaction, secondsLeft);
		}

		// Find the animal in giver's collection
		const animalInfo = findAnimalInCollection(giverDB.huntStats, animalName);
		if (!animalInfo) {
			return await showAnimalNotFoundError(interaction, animalName);
		}

		if (animalInfo.count < amount) {
			return await showInsufficientAnimalsError(interaction, animalInfo, amount);
		}

		// Show confirmation
		await showGiveConfirmation(interaction, receiverUser, animalInfo, amount);
	} catch (error) {
		console.error("Error in give command:", error);
		await handleCommandError(interaction, error);
	}
};

function findAnimalInCollection(huntStats, animalName) {
	for (const [rarity, animalData] of Object.entries(huntStats)) {
		if (animals[rarity]) {
			for (const [storedAnimalName, data] of Object.entries(animalData)) {
				if (storedAnimalName.toLowerCase() === animalName && data && data.count > 0) {
					const animalInfo = animals[rarity].find((a) => a.name === storedAnimalName);
					if (animalInfo) {
						return {
							...animalInfo,
							rarity: rarity,
							count: data.count,
							storedName: storedAnimalName,
						};
					}
				}
			}
		}
	}
	return null;
}

async function showSelfGiveError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle(`${giveEmoji} Không thể tự tặng`)
		.setColor("#FF6B6B")
		.setDescription(
			`🤔 **Bạn không thể tặng animal cho chính mình!**\n\n${sparkleEmoji} Hãy tặng cho bạn bè để chia sẻ niềm vui!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Sử dụng /give @friend [animal] để tặng cho bạn bè!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showBotGiveError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle(`${giveEmoji} Không thể tặng cho Bot`)
		.setColor("#FF6B6B")
		.setDescription(`🤖 **Bot không cần animals!**\n\n${sparkleEmoji} Hãy tặng cho người thật để họ cảm thấy vui vẻ!`)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Chỉ có thể tặng cho người dùng thật!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showNoAnimalsError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle(`${petEmoji} Không có animals`)
		.setColor("#FF6B6B")
		.setDescription(
			`🔍 **Bạn chưa có animals nào để tặng!**\n\n🏹 Hãy dùng lệnh \`\`\`text\n/hunt\n\`\`\` để bắt animals trước!\n\n${sparkleEmoji} Sau khi có animals, bạn có thể tặng cho bạn bè!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Sử dụng /hunt để bắt đầu collection của bạn!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showDailyLimitError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle(`${clockEmoji} Đã đạt giới hạn`)
		.setColor("#FFD700")
		.setDescription(
			`⏳ **Bạn đã tặng tối đa ${MAX_GIVE_PER_DAY} animals hôm nay!**\n\n🌅 Hãy quay lại vào ngày mai để tiếp tục tặng!\n\n💡 Giới hạn này giúp duy trì cân bằng game.`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `Giới hạn: ${MAX_GIVE_PER_DAY} lần/ngày • Reset lúc 00:00`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showGiveCooldown(interaction, secondsLeft) {
	const embed = new EmbedBuilder()
		.setTitle(`${clockEmoji} Give Cooldown`)
		.setColor("#FFD700")
		.setDescription(
			`⏳ **Vui lòng đợi trước khi tặng tiếp!**\n\n${clockEmoji} **Thời gian còn lại:** ${secondsLeft} giây\n\n💡 Cooldown ngăn spam và bảo vệ economy.`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `Quay lại sau ${secondsLeft} giây!`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showAnimalNotFoundError(interaction, animalName) {
	const embed = new EmbedBuilder()
		.setTitle(`${petEmoji} Animal không tìm thấy`)
		.setColor("#FF6B6B")
		.setDescription(
			`🔍 **Không tìm thấy animal "${animalName}" trong collection của bạn!**\n\n💡 **Gợi ý:**\n• Kiểm tra chính tả tên animal\n• Dùng \`/zoo\` để xem collection\n• Chỉ có thể tặng animals bạn đã sở hữu`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Sử dụng /zoo để xem collection của bạn!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showInsufficientAnimalsError(interaction, animalInfo, requestedAmount) {
	const embed = new EmbedBuilder()
		.setTitle(`${petEmoji} Không đủ animals`)
		.setColor("#FF6B6B")
		.setDescription(
			`💸 **Bạn không có đủ ${animalInfo.emoji} ${animalInfo.name}!**\n\n**Hiện có:** ${animalInfo.count}\n**Muốn tặng:** ${requestedAmount}\n**Thiếu:** ${requestedAmount - animalInfo.count}\n\n🏹 Hãy đi săn thêm để có nhiều animals hơn!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Sử dụng /hunt để bắt thêm animals!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function showGiveConfirmation(interaction, receiverUser, animalInfo, amount) {
	const totalValue = animalInfo.value * amount;
	const rarityEmojis = {
		common: "⚪",
		uncommon: "🟢",
		rare: "🔵",
		epic: "🟣",
		legendary: "🟡",
	};

	const embed = new EmbedBuilder()
		.setTitle(`${giveEmoji} Xác nhận tặng Animal`)
		.setColor("#FFD700")
		.setDescription(
			`${sparkleEmoji} **Bạn có chắc muốn tặng?**\n\n${arrowEmoji} **Từ:** ${interaction.user}\n${arrowEmoji} **Đến:** ${receiverUser}\n\n${animalInfo.emoji} **Animal:** ${animalInfo.name}\n${rarityEmojis[animalInfo.rarity]} **Rarity:** ${animalInfo.rarity}\n📊 **Số lượng:** ${amount}\n💰 **Tổng giá trị:** ${totalValue.toLocaleString()} ZiGold\n\n⚠️ **Lưu ý:** Hành động này không thể hoàn tác!`,
		)
		.setThumbnail(receiverUser.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Nhấn Confirm để tặng hoặc Cancel để hủy bỏ",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`confirm_give:${interaction.user.id}:${receiverUser.id}:${animalInfo.storedName}:${amount}:${Date.now()}`)
			.setLabel("Confirm Give")
			.setStyle(ButtonStyle.Success)
			.setEmoji(giveEmoji),
		new ButtonBuilder()
			.setCustomId(`cancel_give:${interaction.user.id}:${Date.now()}`)
			.setLabel("Cancel")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("❌"),
	);

	await interaction.reply({ embeds: [embed], components: [row] });
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
	console.error("Give command error:", error);
	const errorEmbed = new EmbedBuilder()
		.setTitle("❌ Lỗi")
		.setColor("#FF0000")
		.setDescription("Có lỗi xảy ra khi tặng animal. Vui lòng thử lại!");

	if (interaction.replied || interaction.deferred) {
		return await interaction.editReply({ embeds: [errorEmbed] });
	} else {
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}
