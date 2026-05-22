const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
//====================================================================//

module.exports.data = {
	name: "playerPlay",
	type: "player",
};

//====================================================================//

/**
 *
 * @param { import ("discord.js").BaseInteraction } interaction
 * @param { string } query
 * @param { import ("../../lang/vi") } lang
 */
module.exports.execute = async ({ interaction, query, lang, options = {} }) => {
	logger.debug(`Executing command with query: ${JSON.stringify(query)}`);
	const { client, guild, user } = interaction;

	let player = getPlayer(guild.id);
	let createNewPlayer = false;
	logger.debug("Handling play request");
	if (!player?.connection) {
		player = await useHooks.get("functions").get("playerCreate")?.execute({ interaction, lang, options });
		if (!player?.connection) return;
		createNewPlayer = true;
	}

	try {
		let reqPlayOK = false;
		if (!!query) reqPlayOK = await player.play(query, interaction?.user);

		if (!!query && !reqPlayOK) throw new Error("Play request failed");

		await cleanUpInteraction(interaction, createNewPlayer);
		logger.debug("Track played successfully");
	} catch (e) {
		console.log(e);
		logger.error(`Error in handlePlayRequest:  ${JSON.stringify(e)}`);
		await handleError(interaction, lang);
	}
};

async function cleanUpInteraction(interaction, createNewPlayer) {
	logger.debug("Starting cleanUpInteraction");
	if (!createNewPlayer) {
		logger.debug("Queue metadata exists");
		if (interaction?.customId === "S_player_Search") {
			await interaction.message.delete().catch(() => {
				logger.debug("Failed to delete interaction message");
			});
		}
		await interaction?.deleteReply?.().catch(() => {
			logger.debug("Failed to delete interaction reply");
		});
	} else {
		logger.debug("No queue metadata");
		if (interaction?.customId === "S_player_Search") {
			await interaction?.deleteReply?.().catch(() => {
				logger.debug("Failed to delete interaction reply");
			});
		}
	}
	logger.debug("Exiting cleanUpInteraction");
	return;
}

async function handleError(interaction, lang) {
	logger.debug("Starting handleError");
	const response = { content: lang?.music?.NOres ?? "❌ | Không tìm thấy bài hát", ephemeral: true };
	if (interaction.replied || interaction.deferred) {
		logger.debug("Interaction already replied or deferred");
		try {
			await interaction.editReply(response);
			logger.debug("Edited interaction reply successfully");
		} catch {
			logger.warn("Failed to edit interaction reply, fetching reply");
			const meess = await interaction.fetchReply();
			await meess.edit(response).catch(() => {
				logger.error("Failed to edit fetched reply");
			});
		}
	} else {
		logger.debug("Replying to interaction");
		await interaction.reply(response).catch(() => {
			logger.error("Failed to reply to interaction");
		});
	}
	logger.debug("Exiting handleError");
	return;
}
