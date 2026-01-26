const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { useHooks } = require("zihooks");
const { claimGenshinDaily } = require("../../utils/hoyolab");

module.exports.data = {
	name: "genshin",
	description: "Genshin HoYoLAB daily check-in (bind/claim/auto/status)",
	type: 1,
	options: [
		{
			name: "bind",
			description: "Liên kết cookie HoYoLAB (account_id_v2/ltoken_v2/cookie_token_v2)",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: "account_id_v2",
					description: "account id v2 từ HoYoLAB",
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: "cookie_token_v2",
					description: "Cookie Token v2 từ HoYoLAB",
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: "account_mid_v2",
					description: "Account MID v2 từ HoYoLAB",
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: "claim",
			description: "Nhận daily ngay bây giờ",
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: "auto",
			description: "Bật/tắt tự động nhận daily mỗi ngày",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: "enabled",
					description: "Bật (true) hoặc tắt (false) auto-claim",
					type: ApplicationCommandOptionType.Boolean,
					required: true,
				},
			],
		},
		{
			name: "status",
			description: "Xem trạng thái liên kết và auto-claim",
			type: ApplicationCommandOptionType.Subcommand,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	const db = useHooks.get("db");
	if (!db || !db.ZiUser) {
		return interaction.reply({ content: "Lỗi DB: không thể kết nối database.", ephemeral: true });
	}

	const sub = interaction.options.getSubcommand();

	if (sub === "bind") {
		const account_id_v2 = interaction.options.getString("account_id_v2");
		const account_mid_v2 = interaction.options.getString("account_mid_v2");
		const cookie_token_v2 = interaction.options.getString("cookie_token_v2");

		// Kiểm tra tính hợp lệ của từng option
		const accountIdValid = account_id_v2 && account_id_v2.length >= 5;
		const ltmidValid = account_mid_v2 && account_mid_v2.length >= 10;
		const accountMidValid = account_mid_v2 && account_mid_v2.length >= 10;
		const cookieTokenValid = cookie_token_v2 && cookie_token_v2.length >= 10;

		// Nếu ltuid hoặc ltoken không hợp lệ (bắt buộc)
		if (!ltmidValid || !accountMidValid || !accountIdValid || !cookieTokenValid) {
			// Tạo embed hướng dẫn chi tiết
			const embed = new EmbedBuilder()
				.setTitle(lang?.Genshin?.cookieGuideTitle || "🍪 Hướng dẫn lấy Cookie HoYoLAB")
				.setColor("Red")
				.setDescription(
					lang?.Genshin?.cookieGuideDescription ||
						"Cookie HoYoLAB là thông tin xác thực cần thiết để bot có thể tự động nhận daily check-in cho bạn trong game Genshin Impact.",
				)
				.addFields(
					{
						name: "📋 Các bước lấy Cookie:",
						value: [
							lang?.Genshin?.cookieSteps?.step1 || "**Bước 1:** Truy cập https://www.hoyolab.com/ và đăng nhập",
							lang?.Genshin?.cookieSteps?.step2 || "**Bước 2:** Nhấn `F12` để mở Developer Tools",
							lang?.Genshin?.cookieSteps?.step3 ||
								"**Bước 3:** Vào tab **Application** → **Cookies** → **https://www.hoyolab.com**",
							lang?.Genshin?.cookieSteps?.step4 || "**Bước 4:** Copy các cookie: `ltuid`, `ltoken`, `cookie_token`",
							lang?.Genshin?.cookieSteps?.step5 ||
								"**Bước 5:** Format: `ltuid=123456789; ltoken=abcdef123456; cookie_token=xyz789`",
						].join("\n"),
						inline: false,
					},
					{
						name: lang?.Genshin?.cookieImportant || "⚠️ **Lưu ý quan trọng:**",
						value:
							lang?.Genshin?.cookieWarning ||
							"• KHÔNG BAO GIỜ chia sẻ cookie với người khác\n• Cookie có thể hết hạn và cần cập nhật định kỳ\n• Chỉ sử dụng cookie từ tài khoản của chính bạn",
						inline: false,
					},
				);

			embed
				.addFields(
					{
						name: lang?.Genshin?.cookieExample || "**Ví dụ Cookie hợp lệ:**",
						value:
							lang?.Genshin?.cookieExample ||
							"**Ví dụ Cookie hợp lệ:**\n```\naccount_id_v2: 123456789\ncookie_token_v2: v2_abcdef1234567890abcdef1234567890abcdef12\ncookie_token_v2: v2_xyz7890123456789xyz7890123456789xyz789\n```",
						inline: false,
					},
					{
						name: lang?.Genshin?.cookieFixSteps || "**Cách khắc phục:**",
						value:
							lang?.Genshin?.cookieFixSteps ||
							"1. Lấy lại cookie từ HoYoLAB theo hướng dẫn trên\n2. Copy đầy đủ cookie (bao gồm cả `account_id_v2` và `ltoken_v2`)\n3. Nhập từng giá trị vào option tương ứng trong lệnh `/genshin bind`",
						inline: false,
					},
				)
				.setFooter({ text: lang?.Genshin?.cookieFooter || "Nếu vẫn gặp vấn đề, hãy liên hệ admin server để được hỗ trợ." })
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		// Tạo cookie string từ các options
		const cookieParts = [];
		cookieParts.push(`ltuid_v2=${account_id_v2}`);
		cookieParts.push(`account_id_v2=${account_id_v2}`);
		cookieParts.push(`ltmid_v2=${account_mid_v2}`);
		cookieParts.push(`account_mid_v2=${account_mid_v2}`);

		cookieParts.push(`ltoken_v2=${cookie_token_v2}`);
		cookieParts.push(`cookie_token_v2=${cookie_token_v2}`);

		const finalCookie = cookieParts.join("; ");

		await db.ZiUser.findOneAndUpdate({ userID: interaction.user.id }, { $set: { hoyoCookie: finalCookie } }, { upsert: true });

		const embed = new EmbedBuilder()
			.setTitle("Liên kết HoYoLAB thành công")
			.setColor("Green")
			.setDescription(
				"Cookie đã được lưu bảo mật trong DB. Bạn có thể dùng `/genshin claim` hoặc bật auto bằng `/genshin auto enabled:true`.",
			)
			.setFooter({ text: "Lưu ý: Không chia sẻ cookie cho ai khác." });

		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	if (sub === "claim") {
		await interaction.deferReply({ ephemeral: true });
		const user = await db.ZiUser.findOne({ userID: interaction.user.id });
		const cookie = user?.hoyoCookie;
		if (!cookie) {
			return interaction.editReply({ content: "Bạn chưa liên kết cookie. Dùng `/genshin bind` trước.", ephemeral: true });
		}

		const result = await claimGenshinDaily(cookie);
		const embed = new EmbedBuilder().setColor(
			result.status === "claimed" ? "Green"
			: result.status === "already" ? "Yellow"
			: "Red",
		);

		if (result.status === "claimed") {
			await db.ZiUser.findOneAndUpdate(
				{ userID: interaction.user.id },
				{ $set: { lastGenshinClaim: new Date() } },
				{ upsert: true },
			);
			embed
				.setTitle("Đã nhận daily thành công!")
				.setDescription(result.message)
				.addFields(
					result.rewardName ? { name: "Phần thưởng hôm nay", value: result.rewardName, inline: true } : {},
					result.totalDays ? { name: "Tổng ngày đã nhận", value: String(result.totalDays), inline: true } : {},
				)
				.setFooter({ text: "Nguồn: HoYoLAB" });
		} else if (result.status === "already") {
			embed
				.setTitle("Hôm nay đã nhận rồi")
				.setDescription(result.message)
				.addFields(
					result.rewardName ? { name: "Phần thưởng hôm nay", value: result.rewardName, inline: true } : {},
					result.totalDays ? { name: "Tổng ngày đã nhận", value: String(result.totalDays), inline: true } : {},
				);
		} else {
			// Kiểm tra nếu lỗi là "Not logged in"
			if (result.message && result.message.toLowerCase().includes("not logged in")) {
				const errorEmbed = new EmbedBuilder()
					.setTitle(lang?.Genshin?.notLoggedInTitle || "🔐 Cookie đã hết hạn hoặc không hợp lệ")
					.setColor("Red")
					.setDescription(
						lang?.Genshin?.notLoggedInDescription ||
							"Cookie HoYoLAB của bạn đã hết hạn hoặc không hợp lệ. Bạn cần cập nhật cookie mới.",
					)
					.addFields(
						{
							name: "📋 Các bước lấy Cookie:",
							value: [
								lang?.Genshin?.cookieSteps?.step1 || "**Bước 1:** Truy cập https://www.hoyolab.com/ và đăng nhập",
								lang?.Genshin?.cookieSteps?.step2 || "**Bước 2:** Nhấn `F12` để mở Developer Tools",
								lang?.Genshin?.cookieSteps?.step3 ||
									"**Bước 3:** Vào tab **Application** → **Cookies** → **https://www.hoyolab.com**",
								lang?.Genshin?.cookieSteps?.step4 || "**Bước 4:** Copy các cookie: `ltuid`, `ltoken`, `cookie_token`",
								lang?.Genshin?.cookieSteps?.step5 || "**Bước 5:** Nhập từng giá trị riêng biệt vào các option tương ứng",
							].join("\n"),
							inline: false,
						},
						{
							name: lang?.Genshin?.notLoggedInReasons || "**Nguyên nhân có thể:**",
							value:
								lang?.Genshin?.notLoggedInReasons ||
								"• Cookie đã hết hạn (thường sau 30 ngày)\n• Tài khoản HoYoLAB đã đăng xuất\n• Cookie bị thay đổi do đăng nhập lại\n• Tài khoản bị khóa tạm thời",
							inline: false,
						},
						{
							name: lang?.Genshin?.notLoggedInFixSteps || "**Cách khắc phục:**",
							value:
								lang?.Genshin?.notLoggedInFixSteps ||
								"1. Truy cập https://www.hoyolab.com/ và đăng nhập lại\n2. Lấy cookie mới theo hướng dẫn trên\n3. Dùng `/genshin bind` để cập nhật cookie mới\n4. Thử `/genshin claim` lại",
							inline: false,
						},
					)
					.setFooter({ text: lang?.Genshin?.cookieFooter || "Nếu vẫn gặp vấn đề, hãy liên hệ admin server để được hỗ trợ." })
					.setTimestamp();

				return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
			}

			embed.setTitle("Nhận daily thất bại").setDescription(result.message || "Có lỗi xảy ra.");
		}

		return interaction.editReply({ embeds: [embed], ephemeral: true });
	}

	if (sub === "auto") {
		const enabled = interaction.options.getBoolean("enabled");
		await db.ZiUser.findOneAndUpdate(
			{ userID: interaction.user.id },
			{ $set: { genshinAutoClaim: !!enabled } },
			{ upsert: true },
		);
		return interaction.reply({ content: `Auto-claim: ${enabled ? "BẬT" : "TẮT"}.`, ephemeral: true });
	}

	if (sub === "status") {
		const user = await db.ZiUser.findOne({ userID: interaction.user.id });
		const linked = !!user?.hoyoCookie;
		const auto = !!user?.genshinAutoClaim;
		const last = user?.lastGenshinClaim ? `<t:${Math.floor(new Date(user.lastGenshinClaim).getTime() / 1000)}:R>` : "Chưa có";

		const embed = new EmbedBuilder()
			.setTitle("Genshin Daily Status")
			.setColor("Blue")
			.addFields(
				{ name: "Liên kết", value: linked ? "ĐÃ LIÊN KẾT" : "CHƯA", inline: true },
				{ name: "Auto-claim", value: auto ? "BẬT" : "TẮT", inline: true },
				{ name: "Lần nhận gần nhất", value: last, inline: true },
			);

		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	// Fallback
	try {
		return interaction.reply({ content: "Subcommand không hợp lệ.", ephemeral: true });
	} catch (e) {
		useHooks.get("logger").error("genshin cmd error:", e);
	}
};
