const { EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");

function removeVietnameseTones(str) {
	if (!str) return "";
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
	str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
	str = str.replace(/\u02C6|\u0306|\u031B/g, "");
	str = str.replace(/ + /g, " ");
	str = str.trim();
	str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
	return str;
}

function getTitle(attributes) {
	return (
		attributes?.titles?.en ||
		attributes?.titles?.en_jp ||
		attributes?.titles?.ja_jp ||
		attributes?.canonicalTitle ||
		"Unknown Title"
	);
}

module.exports.Zisearch = async (params) => {
	try {
		let search = encodeURIComponent(removeVietnameseTones(params));
		// Tăng limit lên một chút để dễ filter theo ID nếu cần
		const Link = `https://kitsu.io/api/edge/anime?filter[text]=${search}&page[limit]=5`;
		const response = await fetch(Link);
		const body = await response.json();
		return body.data || [];
	} catch (e) {
		console.error("API Error:", e);
		return [];
	}
};

module.exports.data = {
	name: "anime",
	description: "Xem thông tin anime cực nhanh.",
	type: 1,
	options: [
		{
			name: "name",
			description: "Nhập tên anime bạn muốn tìm",
			type: 3,
			required: true,
			autocomplete: true,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const { options, user } = interaction;
	const query = options.getString("name", true);

	// Tách name và id từ value của autocomplete
	const [name, id] = query.split(":::");
	const data = await this.Zisearch(name);

	if (!data || data.length === 0) {
		return interaction.editReply({
			embeds: [new EmbedBuilder().setColor("Red").setDescription(lang?.until?.noresult || "Không tìm thấy anime này rồi!")],
		});
	}

	// Tìm anime khớp ID hoặc lấy kết quả đầu tiên
	let selectedAnime = id ? data.find((a) => a.id === id) : data[0];
	if (!selectedAnime) selectedAnime = data[0];

	const anime = selectedAnime.attributes;
	const animeId = selectedAnime.id;
	const title = getTitle(anime);

	const info = new EmbedBuilder()
		.setColor(lang?.color || "Blue")
		.setTitle(`**${title}**`)
		.setURL(`https://kitsu.io/anime/${animeId}`)
		.setDescription(
			`**Synopsis:**\n> ${anime?.synopsis ? anime.synopsis.replace(/<[^>]*>/g, "").split("\n")[0] : "No description available."}\n\n` +
				`**[[Trailer]](https://www.youtube.com/watch?v=${anime?.youtubeVideoId || "dQw4w9WgXcQ"})**`,
		)
		.setThumbnail(anime?.posterImage?.original || "")
		.setImage(anime?.coverImage?.large || null)
		.setTimestamp()
		.setFooter({
			text: `${lang?.until?.requestBy || "Requested by"} ${user?.username}`,
			iconURL: user.displayAvatarURL(),
		})
		.addFields([
			{ name: "🗓️ Date", value: `${anime?.startDate || "??"} to ${anime?.endDate || "??"}`, inline: true },
			{ name: "⭐ Rating", value: `${anime?.averageRating || "??"}%`, inline: true },
			{ name: "📇 Type", value: `${anime?.showType || "Unknown"}`, inline: true },
			{ name: "🎞️ Episodes", value: `${anime?.episodeCount || "??"}`, inline: true },
			{ name: "⏱️ Duration", value: `${anime?.episodeLength || "??"} min`, inline: true },
			{ name: "🏆 Rank", value: `#${anime?.ratingRank || "N/A"}`, inline: true },
		]);

	await interaction.editReply({ embeds: [info] }).catch(console.error);
};

module.exports.autocomplete = async ({ interaction }) => {
	try {
		const focusedValue = interaction.options.getFocused();
		if (!focusedValue) return;

		const data = await this.Zisearch(focusedValue);
		if (!data || data.length === 0) return await interaction.respond([]);

		const choices = data.slice(0, 25).map((anime) => {
			const title = getTitle(anime.attributes);
			// Value format: "Tên:::ID" để execute có thể parse lại
			return {
				name: title.length > 100 ? title.substring(0, 97) + "..." : title,
				value: `${title.substring(0, 50)}:::${anime.id}`,
			};
		});

		await interaction.respond(choices);
	} catch (e) {
		console.error("Autocomplete Error:", e);
	}
};
