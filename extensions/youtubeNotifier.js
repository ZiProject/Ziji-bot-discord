const { useHooks } = require("zihooks");
const { MessageFlags, ContainerBuilder, ButtonBuilder, ButtonStyle, MediaGalleryItemBuilder } = require("discord.js");
const cron = require("node-cron");
const axios = require("axios");
const { getManager } = require("ziplayer");

// Helper to parse YouTube RSS feed
function parseYoutubeRss(xmlText) {
	const entries = [];
	const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
	let match;
	while ((match = entryRegex.exec(xmlText)) !== null) {
		const entryContent = match[1];

		const videoIdMatch =
			entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || entryContent.match(/<id>yt:video:([^<]+)<\/id>/);
		const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
		const authorMatch = entryContent.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/) || xmlText.match(/<title>([^<]+)<\/title>/);

		if (videoIdMatch) {
			entries.push({
				videoId: videoIdMatch[1].trim(),
				title: titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : "",
				author: authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : "YouTube Channel",
				url: `https://www.youtube.com/watch?v=${videoIdMatch[1].trim()}`,
			});
		}
	}
	return entries;
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

// Fetch YouTube feed
async function checkYoutubeChannel(channelId) {
	try {
		const response = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
			},
			timeout: 10000,
		});
		return parseYoutubeRss(response.data);
	} catch (error) {
		// Suppress logs for transient network failures but return empty
		return [];
	}
}

// Update DB lastVideoId
async function updateDbChannelLastVideo(db, guildId, channelId, latestVideoId) {
	if (!db || !db.ZiGuild) return;
	try {
		const guildSetting = await db.ZiGuild.findOne({ guildId });
		if (guildSetting && guildSetting.youtube && Array.isArray(guildSetting.youtube.channels)) {
			const channel = guildSetting.youtube.channels.find((c) => c.channelId === channelId);
			if (channel) {
				channel.lastVideoId = latestVideoId;
				if (typeof guildSetting.markModified === "function") {
					guildSetting.markModified("youtube");
				}
				await guildSetting.save();
			}
		}
	} catch (error) {
		useHooks.get("logger")?.error?.(`[YouTube] Error updating lastVideoId in DB for guild ${guildId}:`, error);
	}
}

// Send notification message to Discord channel
async function sendYoutubeNotification(client, sub, video) {
	const log = useHooks.get("logger");
	try {
		const channel = await client.channels.fetch(sub.discordChannelId).catch(() => null);
		if (!channel) {
			log?.warn?.(`[YouTube] Subscribed channel ${sub.discordChannelId} not found/inaccessible in guild ${sub.guildId}.`);
			return;
		}

		// Build message layout using Components V2
		const template = sub.message || "📢 **{author}** vừa đăng video mới:[**{title}**]({url})";
		const rendered = template
			.replace(/{author}/g, video.author)
			.replace(/{title}/g, video.title)
			.replace(/{url}/g, video.url);

		const container = new ContainerBuilder().setAccentColor([255, 0, 0]); // YouTube red

		// Main section with text and a link button
		container.addSectionComponents((section) =>
			section
				.addTextDisplayComponents((text) => text.setContent(rendered))
				.setButtonAccessory((button) => button.setStyle(ButtonStyle.Link).setURL(video.url).setLabel("Watch")),
		);
		container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));

		const tracks = await getManager().search(video.url, "YouTubeNotifier");

		if (tracks?.tracks?.length) {
			const video = tracks.tracks[0];
			if (video?.thumbnail) {
				container.addMediaGalleryComponents((gallery) => gallery.addItems(new MediaGalleryItemBuilder().setURL(video.thumbnail)));
			}
		}

		await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
	} catch (error) {
		log?.error?.(`[YouTube] Failed to send notification to channel ${sub.discordChannelId} in guild ${sub.guildId}:`, error);
	}
}

// Check all channels in the cache
async function checkNewVideos(client) {
	const log = useHooks.get("logger");
	const db = useHooks.get("db");
	const youtubeCache = useHooks.get("youtubeCache");
	if (!youtubeCache || youtubeCache.size === 0) return;

	log?.debug?.(`[YouTube] Running periodic check for ${youtubeCache.size} channels...`);

	for (const [channelId, subs] of youtubeCache.entries()) {
		try {
			const videos = await checkYoutubeChannel(channelId);
			if (!videos || videos.length === 0) continue;

			const latestVideo = videos[0];
			const latestVideoId = latestVideo.videoId;
			if (!latestVideoId) continue;

			for (const sub of subs) {
				// If lastVideoId is not set, initialize it to avoid spamming old videos
				if (!sub.lastVideoId) {
					sub.lastVideoId = latestVideoId;
					await updateDbChannelLastVideo(db, sub.guildId, channelId, latestVideoId);
					continue;
				}

				if (sub.lastVideoId !== latestVideoId) {
					log?.info?.(
						`[YouTube] New video detected: ${latestVideo.title} by ${latestVideo.author} (${latestVideoId}) for guild ${sub.guildId}`,
					);
					sub.lastVideoId = latestVideoId;

					// Send alert
					await sendYoutubeNotification(client, sub, latestVideo);

					// Save to database
					await updateDbChannelLastVideo(db, sub.guildId, channelId, latestVideoId);
				}
			}
		} catch (err) {
			log?.error?.(`[YouTube] Error checking channel ${channelId}:`, err);
		}
	}
}

module.exports.data = {
	name: "youtubeNotifier",
	type: "extension",
	enable: true,
	priority: 6, // Runs after database is ready (db priority is early/ready event)
};

module.exports.execute = async (client) => {
	const log = useHooks.get("logger");
	log?.info?.("Starting YouTube Notifier extension...");

	const db = useHooks.get("db");
	const youtubeCache = new Map();
	useHooks.set("youtubeCache", youtubeCache);

	if (db && db.ZiGuild) {
		try {
			const guilds = await db.ZiGuild.find().lean();
			for (const guild of guilds) {
				if (guild.youtube && Array.isArray(guild.youtube.channels)) {
					for (const channel of guild.youtube.channels) {
						if (!youtubeCache.has(channel.channelId)) {
							youtubeCache.set(channel.channelId, []);
						}
						youtubeCache.get(channel.channelId).push({
							guildId: guild.guildId,
							discordChannelId: channel.discordChannelId,
							message: channel.message,
							lastVideoId: channel.lastVideoId,
						});
					}
				}
			}
			log?.info?.(`[YouTube] Loaded ${youtubeCache.size} YouTube channels into cache.`);
		} catch (error) {
			log?.error?.("[YouTube] Error loading YouTube settings into cache on startup:", error);
		}
	}

	// Wait 15 seconds after ready to perform initial check
	setTimeout(() => {
		checkNewVideos(client).catch((err) => log?.error?.("[YouTube] Initial new video check failed:", err));
	}, 15000);

	// Schedule check every 5 minutes
	cron.schedule("*/5 * * * *", async () => {
		try {
			await checkNewVideos(client);
		} catch (err) {
			log?.error?.("[YouTube] Scheduled new video check failed:", err);
		}
	});
};
