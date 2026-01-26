const { useHooks } = require("zihooks");
const { AttachmentBuilder } = require("discord.js");
const { PlayerManager } = require("ziplayer");

module.exports.data = {
	name: "music",
	description: "Lệnh music",
	category: "musix",
	type: 1,
	options: [
		{
			name: "download",
			description: "Tải nhạc",
			type: 1,
			options: [
				{
					name: "query",
					description: "Tên bài hát",
					type: 3,
					required: true,
				},
			],
		},
	],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 * @param {import("ziplayer").Player} command.player - player
 */
module.exports.execute = async ({ interaction, lang, player: defaultPlayer }) => {
	await interaction.deferReply({ withResponse: true });
	const player = defaultPlayer ?? (await PlayerManager.default()); // apply filter if provided
	const track = await player.search(interaction.options.getString("query"), interaction.user);

	const stream = await player.save(track.tracks[0]);
	//Stream.Readable to Buffer
	let buffer = [];
	stream.on("data", (chunk) => {
		buffer.push(chunk);
	});
	stream.on("end", async () => {
		buffer = Buffer.concat(buffer);
		const file = new AttachmentBuilder(buffer, { name: `${track.tracks[0].title} saved.mp3` });
		await interaction.editReply({ content: lang.music.DownloadOK, files: [file] }).catch((e) => {
			interaction.followUp({ content: lang.music.DownloadNGLargeFile }).catch((e) => {});
		});
	});
	stream.on("error", async (error) => {
		console.error(error);
		await interaction.editReply({ content: lang.music.DownloadNG }).catch((e) => {});
	});
};
