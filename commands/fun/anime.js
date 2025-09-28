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

const { EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");

function removeVietnameseTones(str) {
	str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
	str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
	str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
	str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
	str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
	str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
	str = str.replace(/đ/g, "d");
	str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
	str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
	str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
	str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
	str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
	str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
	str = str.replace(/Đ/g, "D");
	// Some system encode vietnamese combining accent as individual utf-8 characters
	// Một vài bộ encode coi các dấu mũ, dấu chữ như một kí tự riêng biệt nên thêm hai dòng này
	str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
	str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
	// Remove extra spaces
	// Bỏ các khoảng trắng liền nhau
	str = str.replace(/ + /g, " ");
	str = str.trim();
	// Remove punctuations
	// Bỏ dấu câu, kí tự đặc biệt
	str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
	return str;
}

function getTitle(anime) {
	return anime?.titles?.en_jp || anime?.titles?.en || anime.titles?.ja_jp || "unknown";
}

module.exports.Zisearch = async (params) => {
	try {
		let search = encodeURI(removeVietnameseTones(params));
		const Link = "https://kitsu.io/api/edge/" + "anime?filter[text]=" + search + "&page[limit]=" + 2;
		const response = await fetch(Link);
		const body = await response.json();
		return body.data;
	} catch (e) {
		console.log(e);
		return [];
	}
};

module.exports.data = {
	name: "anime",
	description: "Get anime information.",
	type: 1, // slash command
	options: [
		{
			name: "name",
			description: "Name anime",
			type: 3, // string
			required: true,
			autocomplete: true,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const { options, user } = interaction;
	const query = options.getString("name", true);
	const [name, id] = query.split(":::");
	const data = await this.Zisearch(name);

	if (!data.length) {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(lang?.color || "Random")
					.setTimestamp()
					.setDescription(lang?.until.noresult)
					.setFooter({
						text: `${lang.until.requestBy} ${user?.username}`,
						iconURL: user.displayAvatarURL({ size: 1024 }),
					}),
			],
		});

		return;
	}
	let anime = null;
	if (id) anime = data?.find((anime) => anime.id === id);
	if (anime) anime = anime.attributes;
	else anime = data?.at(0).attributes;

	const title = getTitle(anime);

	const info = new EmbedBuilder()
		.setColor(lang?.color || "Random")
		.setTitle(`**${title}**`)
		.setURL(`https://kitsu.io/anime/${anime?.id}`)
		.setDescription(
			`**Synopsis:**\n> ${anime?.synopsis.replace(/<[^>]*>/g, "").split("\n")[0]}
        **[[Trailer]](https://www.youtube.com/watch?v=${anime?.youtubeVideoId})**`,
		)
		.setTimestamp()
		.setThumbnail(anime?.posterImage?.original || user.displayAvatarURL({ size: 1024 }))
		.setImage(anime?.coverImage?.large || lang.botConfig.Banner)
		.setFooter({
			text: `${lang.until.requestBy} ${user?.username}`,
			iconURL: user.displayAvatarURL({ size: 1024 }),
		})
		.addFields([
			{
				name: "**🗓️ Date:**",
				value: `${anime?.startDate ? anime.startDate : "Unknown"}/${anime?.endDate ? anime.endDate : "Unknown"}`,
				inline: true,
			},
			{ name: "**⭐ Rating:**", value: `${anime?.averageRating ? anime.averageRating : "??"}`, inline: true },
			{ name: "**📇 Type:**", value: `${anime?.showType ? anime.showType : "Unknown"}`, inline: true },
			{ name: "**🎞️ Episodes:**", value: `${anime?.episodeCount ? anime.episodeCount : "??"}`, inline: true },
			{ name: "**⏱️ Duration:**", value: `${anime?.episodeLength ? anime.episodeLength : "??"} minutes`, inline: true },
			{ name: "**🏆 Rank:**", value: `${anime?.ratingRank ? anime.ratingRank : "Unknwon"}`, inline: true },
		]);
	await interaction?.editReply({ content: ``, embeds: [info] }).catch(() => {});
	return;
};

/**
 * @param { object } autocomplete - object autocomplete
 * @param { AutocompleteInteraction } autocomplete.interaction - interaction
 * @param { import('../../lang/vi.js') } autocomplete.lang - language
 */

module.exports.autocomplete = async ({ interaction, lang }) => {
	try {
		const name = interaction.options.getString("name", true);
		const data = await this.Zisearch(name);
		if (!data.length) return;

		await interaction.respond(
			data.map((anime) => ({
				name: getTitle(anime.attributes),
				value: `${getTitle(anime.attributes)}:::${anime.id}`,
			})),
		);
		return;
	} catch (e) {
		console.error(e);
	}
};
