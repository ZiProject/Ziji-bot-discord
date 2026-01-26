const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "createErrorEmbed",
	type: "utils",
};

module.exports.execute = (message) => {
	const embed = new EmbedBuilder()
		.setTitle(`❌ | Đã xảy ra lỗi`)
		.setDescription(message)
		.setColor("Red")
		.setTimestamp()
		.setThumbnail(require("zihooks").useHooks.get("client").user.displayAvatarURL({ size: 1024 }));
	return embed.data;
};
