const Encryptor = require("@zibot/ziencryptor");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "Play / Add music",
	type: 3, // context
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } context - object command
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } context.interaction - interaction
 * @param { import('../../lang/vi.js') } context.lang - language
 */

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
		let query = interaction.targetMessage.content;

		if (!query) {
			query = await handleEmbed(interaction, lang);
			if (query === "ZibotZibotZibotZibot") return;
		}

		if (!query) {
			const links = extractLinksFromComponents(interaction.targetMessage.components);

			if (links.length) {
				query = links[0];
			}
		}
		if (!query) {
			console.error("No valid query found.");
			return;
		}

		const searchCommand = useHooks.get("functions").get("playerController");
		await searchCommand.execute(interaction, query, lang);
	} catch (error) {
		console.error("Error executing command:", error);
	}
};

/**
 * Xử lý khi targetMessage có embed.
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } interaction - interaction.
 * @returns { string | null } Trả về query hoặc null nếu không có.
 */
async function handleEmbed(interaction, lang) {
	const embed = interaction.targetMessage.embeds?.at(0)?.data;

	if (!embed) return null;

	if (embed.author?.name?.includes("Save Queue:")) {
		const restoredTracks = await handleSaveQueue(interaction, lang);
		if (restoredTracks) return restoredTracks;
	}

	return embed?.author?.url || embed?.description || null;
}

/**
 * Xử lý khi message chứa file "save.txt".
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } interaction - interaction.
 * @returns { Array | null } Trả về tracks hoặc null nếu không có.
 */
async function handleSaveQueue(interaction, lang) {
	const file = interaction.targetMessage.attachments?.at(0);

	if (!file || file.name !== "zsave.txt") return null;

	try {
		const response = await fetch(file.url);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const encryptedData = await response.text();
		const decryptor = new Encryptor("Z");
		const decryptedData = decryptor.decrypt(encryptedData);

		const restoreCommand = useHooks.get("functions").get("Restored_tracks");
		await restoreCommand.execute(interaction, decryptedData, lang);

		return "ZibotZibotZibotZibot";
	} catch (error) {
		console.error("Error restoring tracks:", error);
		return null;
	}
}

function extractLinksFromComponents(components = []) {
	const urls = [];

	const walk = (items) => {
		for (const item of items || []) {
			// URL button
			if (item?.data?.url) {
				urls.push(item.data.url);
			}

			// Markdown links in text content
			if (typeof item?.data?.content === "string") {
				const matches = [...item.data.content.matchAll(/\((https?:\/\/[^\s)]+)\)/g)];

				for (const match of matches) {
					urls.push(match[1]);
				}
			}

			// Select menu option values
			if (Array.isArray(item?.options)) {
				for (const option of item.options) {
					if (typeof option?.data?.value === "string" && /^https?:\/\//.test(option.data.value)) {
						urls.push(option.data.value);
					}
				}
			}

			// Nested components
			if (Array.isArray(item?.components)) {
				walk(item.components);
			}

			// Media gallery
			if (Array.isArray(item?.items)) {
				for (const media of item.items) {
					const mediaUrl = media?.data?.media?.url;

					if (mediaUrl) {
						urls.push(mediaUrl);
					}
				}
			}
		}
	};

	walk(components);

	return [...new Set(urls)];
}
