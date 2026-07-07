const {
	PermissionsBitField,
	EmbedBuilder,
	MessageFlags,
	ContainerBuilder,
	ButtonBuilder,
	ButtonStyle,
	MediaGalleryItemBuilder,
} = require("discord.js");
const { useHooks } = require("zihooks");
const axios = require("axios");
const { getManager } = require("ziplayer");

// Helper to resolve YouTube channel ID from URL, ID, or handle
async function resolveYoutubeChannelId(input) {
	const trimmed = input.trim();
	// If it's already a channel ID (UC followed by 22 characters)
	if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
		return trimmed;
	}
	// Check if it's a channel URL with UC...
	const channelUrlMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
	if (channelUrlMatch) {
		return channelUrlMatch[1];
	}
	// Check if it's a handle (starts with @ or URL has /@)
	let handle = null;
	if (trimmed.startsWith("@")) {
		handle = trimmed;
	} else {
		const handleMatch = trimmed.match(/youtube\.com\/(@[a-zA-Z0-9._-]+)/);
		if (handleMatch) {
			handle = handleMatch[1];
		}
	}

	if (handle) {
		try {
			const url = `https://www.youtube.com/${handle}`;
			const response = await axios.get(url, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
				timeout: 10000,
			});
			const html = response.data;

			// Match metadata identifier
			const metaMatch =
				html.match(/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{22})"/i) ||
				html.match(/<meta\s+content="(UC[a-zA-Z0-9_-]{22})"\s+itemprop="identifier"/i);
			if (metaMatch) return metaMatch[1];

			// Match browseId
			const browseIdMatch = html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
			if (browseIdMatch) return browseIdMatch[1];

			// Match externalId
			const externalIdMatch = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
			if (externalIdMatch) return externalIdMatch[1];

			// Match channel link
			const channelLinkMatch = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
			if (channelLinkMatch) return channelLinkMatch[1];
		} catch (error) {
			console.error(`[YouTube Resolve] Error resolving handle ${handle}:`, error.message);
		}
	}
	return null;
}

// Helper to check YouTube RSS and fetch the latest video details
async function getLatestVideo(channelId) {
	try {
		const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
			},
			timeout: 10000,
		});
		const xml = response.data;
		const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
		if (entryMatch) {
			const entryContent = entryMatch[1];
			const videoIdMatch =
				entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || entryContent.match(/<id>yt:video:([^<]+)<\/id>/);
			const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
			const authorMatch = entryContent.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/) || xml.match(/<title>([^<]+)<\/title>/);

			return {
				videoId: videoIdMatch ? videoIdMatch[1].trim() : null,
				title: titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : "",
				author: authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : "YouTube Channel",
			};
		}
		// In case feed is valid but empty
		const authorMatch = xml.match(/<title>([^<]+)<\/title>/);
		return {
			videoId: null,
			title: "",
			author: authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : "YouTube Channel",
		};
	} catch (error) {
		return null;
	}
}

function decodeXmlEntities(str) {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

module.exports.data = {
	name: "youtube",
	description: "Quản lý thông báo video mới từ YouTube",
	type: 1, // ChatInput Slash Command
	options: [
		{
			name: "setup",
			description: "Đăng ký nhận thông báo video mới từ YouTube",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Nhập URL kênh, handle (@tên_kênh), hoặc ID (UC...)",
					type: 3,
					required: true,
				},
				{
					name: "discord_channel",
					description: "Kênh Discord để gửi thông báo",
					type: 7,
					required: true,
					channel_types: [0, 5],
				},
				{
					name: "message",
					description: "Nội dung tùy chỉnh (dùng {author}, {title}, {url} làm placeholder)",
					type: 3,
					required: false,
				},
			],
		},
		{
			name: "test",
			description: "Gửi video mới nhất từ kênh thử vào kênh hiện tại hoặc kênh chỉ định",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Nhập URL kênh, handle (@tên_kênh), hoặc ID (UC...)",
					type: 3,
					required: true,
				},
				{
					name: "discord_channel",
					description: "Kênh Discord để gửi thử (mặc định: kênh hiện tại)",
					type: 7,
					required: false,
					channel_types: [0, 5],
				},
			],
		},
		{
			name: "remove",
			description: "Hủy nhận thông báo từ một kênh YouTube",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Nhập URL kênh, handle (@tên_kênh), hoặc ID (UC...) cần xóa",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "list",
			description: "Danh sách các kênh YouTube đang đăng ký nhận thông báo",
			type: 1,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0", // Admin permissions
};

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply({ ephemeral: true });

	const db = useHooks.get("db");
	if (!db) {
		return interaction.editReply({
			content: "❌ Database hiện không hoạt động. Vui lòng liên hệ nhà phát triển.",
		});
	}

	const subcommand = interaction.options.getSubcommand();
	const guildId = interaction.guild.id;

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.editReply({
			content: "❌ Bạn cần có quyền `Quản lý Máy chủ` để thực hiện thao tác này.",
		});
	}

	if (subcommand === "setup") {
		const channelInput = interaction.options.getString("channel");
		const discordChannel = interaction.options.getChannel("discord_channel");
		const customMessage = interaction.options.getString("message") || "📢 **{author}** vừa đăng video mới: **{title}**\n{url}";

		// Resolve YouTube channel ID
		const youtubeChannelId = await resolveYoutubeChannelId(channelInput);
		if (!youtubeChannelId) {
			return interaction.editReply({
				content:
					"❌ Không thể tìm thấy ID kênh YouTube từ thông tin bạn cung cấp. Hãy thử URL đầy đủ, ID dạng `UC...` hoặc handle `@tên_kênh`.",
			});
		}

		// Fetch latest video to verify channel and get details
		const latestVideo = await getLatestVideo(youtubeChannelId);
		if (!latestVideo) {
			return interaction.editReply({
				content: "❌ Kênh YouTube không tồn tại hoặc không thể truy cập RSS feed của kênh.",
			});
		}

		// Read & update Database settings
		let guildSetting = await db.ZiGuild.findOne({ guildId });
		if (!guildSetting) {
			guildSetting = new db.ZiGuild({ guildId });
		}

		if (!guildSetting.youtube) {
			guildSetting.youtube = { channels: [] };
		}
		if (!Array.isArray(guildSetting.youtube.channels)) {
			guildSetting.youtube.channels = [];
		}

		const existingIndex = guildSetting.youtube.channels.findIndex((c) => c.channelId === youtubeChannelId);
		const channelData = {
			channelId: youtubeChannelId,
			channelName: latestVideo.author,
			discordChannelId: discordChannel.id,
			message: customMessage,
			lastVideoId: latestVideo.videoId || "",
		};

		if (existingIndex > -1) {
			guildSetting.youtube.channels[existingIndex] = channelData;
		} else {
			guildSetting.youtube.channels.push(channelData);
		}

		if (typeof guildSetting.markModified === "function") {
			guildSetting.markModified("youtube");
		}
		await guildSetting.save();

		// Update Zihooks Cache
		let youtubeCache = useHooks.get("youtubeCache");
		if (!youtubeCache) {
			youtubeCache = new Map();
			useHooks.set("youtubeCache", youtubeCache);
		}

		if (!youtubeCache.has(youtubeChannelId)) {
			youtubeCache.set(youtubeChannelId, []);
		}
		const subs = youtubeCache.get(youtubeChannelId);
		const subIndex = subs.findIndex((s) => s.guildId === guildId);
		const subData = {
			guildId,
			discordChannelId: discordChannel.id,
			message: customMessage,
			lastVideoId: latestVideo.videoId || "",
		};

		if (subIndex > -1) {
			subs[subIndex] = subData;
		} else {
			subs.push(subData);
		}

		return interaction.editReply({
			content: `✅ Đã đăng ký nhận thông báo video mới từ kênh YouTube **${latestVideo.author}** (${youtubeChannelId}) gửi vào kênh <#${discordChannel.id}>.`,
		});
	}

	if (subcommand === "remove") {
		const channelInput = interaction.options.getString("channel");
		const youtubeChannelId = await resolveYoutubeChannelId(channelInput);

		if (!youtubeChannelId) {
			return interaction.editReply({
				content: "❌ Không thể tìm thấy thông tin kênh YouTube. Vui lòng kiểm tra lại dữ liệu nhập.",
			});
		}

		const guildSetting = await db.ZiGuild.findOne({ guildId });
		if (
			!guildSetting ||
			!guildSetting.youtube ||
			!Array.isArray(guildSetting.youtube.channels) ||
			guildSetting.youtube.channels.length === 0
		) {
			return interaction.editReply({
				content: "❌ Máy chủ hiện tại chưa đăng ký nhận thông báo từ kênh YouTube nào.",
			});
		}

		const channels = guildSetting.youtube.channels;
		const index = channels.findIndex((c) => c.channelId === youtubeChannelId);
		if (index === -1) {
			return interaction.editReply({
				content: "❌ Máy chủ chưa đăng ký nhận thông báo từ kênh YouTube này.",
			});
		}

		const removedChannel = channels[index];
		channels.splice(index, 1);

		if (typeof guildSetting.markModified === "function") {
			guildSetting.markModified("youtube");
		}
		await guildSetting.save();

		// Update Zihooks Cache
		const youtubeCache = useHooks.get("youtubeCache");
		if (youtubeCache && youtubeCache.has(youtubeChannelId)) {
			const subs = youtubeCache.get(youtubeChannelId);
			const subIndex = subs.findIndex((s) => s.guildId === guildId);
			if (subIndex > -1) {
				subs.splice(subIndex, 1);
				if (subs.length === 0) {
					youtubeCache.delete(youtubeChannelId);
				}
			}
		}

		return interaction.editReply({
			content: `✅ Đã hủy đăng ký nhận thông báo cho kênh YouTube **${removedChannel.channelName || youtubeChannelId}**.`,
		});
	}

	if (subcommand === "test") {
		const channelInput = interaction.options.getString("channel");
		const discordChannel = interaction.options.getChannel("discord_channel") || interaction.channel;

		const youtubeChannelId = await resolveYoutubeChannelId(channelInput);
		if (!youtubeChannelId) {
			return interaction.editReply({
				content: "❌ Không thể tìm thấy ID kênh YouTube từ thông tin bạn cung cấp.",
			});
		}

		const latestVideo = await getLatestVideo(youtubeChannelId);
		if (!latestVideo || !latestVideo.videoId) {
			return interaction.editReply({ content: "❌ Không thể lấy video mới nhất từ kênh này." });
		}

		const template = "📢 **{author}** vừa đăng video mới: [**{title}**]({url})";
		const rendered = template
			.replace(/{author}/g, latestVideo.author)
			.replace(/{title}/g, latestVideo.title)
			.replace(/{url}/g, `https://www.youtube.com/watch?v=${latestVideo.videoId}`);

		const container = new ContainerBuilder().setAccentColor([255, 0, 0]);

		container.addSectionComponents((section) =>
			section
				.addTextDisplayComponents((text) => text.setContent(rendered))
				.setButtonAccessory((button) =>
					button.setStyle(ButtonStyle.Link).setURL(`https://www.youtube.com/watch?v=${latestVideo.videoId}`).setLabel("Watch"),
				),
		);
		container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));

		const tracks = await getManager().search(`https://www.youtube.com/watch?v=${latestVideo.videoId}`, interaction.user);

		if (tracks?.tracks?.length) {
			const video = tracks.tracks[0];
			if (video?.thumbnail) {
				container.addMediaGalleryComponents((gallery) => gallery.addItems(new MediaGalleryItemBuilder().setURL(video.thumbnail)));
			}
		}
		try {
			await discordChannel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
			return interaction.editReply({
				content: `✅ Đã gửi thử video mới nhất của **${latestVideo.author}** vào <#${discordChannel.id}>.`,
			});
		} catch (err) {
			return interaction.editReply({ content: `❌ Không thể gửi tin nhắn thử: ${err.message}` });
		}
	}

	if (subcommand === "list") {
		const guildSetting = await db.ZiGuild.findOne({ guildId });
		if (
			!guildSetting ||
			!guildSetting.youtube ||
			!Array.isArray(guildSetting.youtube.channels) ||
			guildSetting.youtube.channels.length === 0
		) {
			return interaction.editReply({
				content: "ℹ️ Máy chủ chưa đăng ký nhận thông báo từ bất kỳ kênh YouTube nào.",
			});
		}

		const embed = new EmbedBuilder().setTitle("📺 Danh sách kênh YouTube đang theo dõi").setColor("Red").setTimestamp();

		let description = "";
		guildSetting.youtube.channels.forEach((c, i) => {
			description +=
				`${i + 1}. **${c.channelName || "Kênh YouTube"}**\n` +
				`   • YouTube ID: \`${c.channelId}\`\n` +
				`   • Kênh gửi: <#${c.discordChannelId}>\n` +
				`   • Thông điệp: \`${c.message}\`\n\n`;
		});

		embed.setDescription(description);
		return interaction.editReply({ embeds: [embed] });
	}
};
