const { PermissionsBitField } = require("discord.js");
const { useHooks } = require("@zibot/zihooks");
const config = useHooks.get("config");

module.exports.data = {
	name: "autoresponder",
	description: "Quản lý các autoresponder",
	type: 1, // slash command
	options: [
		{
			name: "new",
			description: "Tạo một autoresponder mới",
			type: 1,
			options: [
				{
					name: "trigger",
					description: "Tên của autoresponder",
					type: 3,
					required: true,
				},
				{
					name: "response",
					description: "Phản hồi của autoresponder",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "edit",
			description: "Sửa đổi một autoresponder có sẵn",
			type: 1,
			options: [
				{
					name: "trigger",
					description: "Tên của autoresponder",
					type: 3,
					required: true,
					autocomplete: true,
				},
				{
					name: "response",
					description: "Phản hồi mới của autoresponder",
					type: 3,
					required: true,
				},
			],
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0", // chỉ có admin mới dùng được
	enable: config?.DevConfig?.AutoResponder,
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
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
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}
	const db = useHooks.get("db");
	if (!db) return interaction.reply({ content: lang?.until?.noDB });
	const autoRes = useHooks.get("responder");
	const commandtype = interaction.options?.getSubcommand();
	const trigger = interaction.options.getString("trigger");
	const response = interaction.options.getString("response");

	switch (commandtype) {
		case "new":
			return this.newAutoRes({ interaction, lang, options: { trigger, response, db, autoRes } });
		case "edit":
			return this.editAutoRes({ interaction, lang, options: { trigger, response, db, autoRes } });
		default:
			return interaction.reply({ content: lang?.until?.notHavePremission, ephemeral: true });
	}
	return;
};

module.exports.newAutoRes = async ({ interaction, lang, options }) => {
	await interaction.deferReply();

	try {
		const newResponder = await options.db.ZiAutoresponder.create({
			guildId: interaction.guild.id,
			trigger: options.trigger,
			response: options.response,
		});

		if (!options.autoRes.has(interaction.guild.id)) {
			options.autoRes.set(interaction.guild.id, []);
		}
		options.autoRes.get(interaction.guild.id).push({
			trigger: newResponder.trigger,
			response: newResponder.response,
		});

		interaction.editReply(`Đã thêm autoresponder: Khi ai đó gửi \`${options.trigger}\`, bot sẽ trả lời \`${options.response}\`.`);
		return;
	} catch (error) {
		console.error(error);
		interaction.editReply("Đã xảy ra lỗi khi thêm autoresponder.");
	}
	return;
};
