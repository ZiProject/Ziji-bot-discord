const { useHooks } = require("zihooks");
const util = require("node:util");
const { TextDisplayBuilder, MessageFlags, SectionBuilder, ButtonBuilder, ContainerBuilder,UserSelectMenuBuilder } = require("discord.js");
/**
 * This extension file run at bot started.
 */

module.exports.data = {
	name: "testComponentsV2",
	type: "extension",
	enable: false,
};
/**
 *
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	// Your code here ...
	const channel = await client.channels.fetch("1504721560156766305");
	const container = new ContainerBuilder().setAccentColor([255, 125, 80]);
	container
		.addSectionComponents(
			(section) =>
				section
					.addTextDisplayComponents(new TextDisplayBuilder().setContent("Hello World!"))
					.setButtonAccessory(new ButtonBuilder().setCustomId("test_button").setLabel("Test Button").setStyle(1)),
	
		)
		.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(2))
		.addMediaGalleryComponents((media) =>
			media.addItems((item) =>
				item.setURL(
					"https://media.discordapp.net/attachments/1504721560156766305/1526258786547794141/d8a7b276d44a25b2f6217001d8db98bd.webp",
				),
			),
		)
		.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1))
		.addSectionComponents((section) =>
			section
				.addTextDisplayComponents(new TextDisplayBuilder().setContent("Hello World!"))
				.setThumbnailAccessory((thumb) =>
					thumb.setURL(
						"https://media.discordapp.net/attachments/1504721560156766305/1526258786547794141/d8a7b276d44a25b2f6217001d8db98bd.webp",
					),
				),
		)
		.addActionRowComponents((actionRow) =>
			actionRow.setComponents(new UserSelectMenuBuilder().setCustomId("exampleSelect").setPlaceholder("Select users")),
		);
	channel.send({
		flags: MessageFlags.IsComponentsV2,
		components: [container],
	});
};
