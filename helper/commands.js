/**
 * Run when Called
 * await useHooks.get("commands").get("helper").execute(args)
 *
 * called in interactionCreate file: .execute(args)
 * called in messageCommands file: .run(args)
 */

module.exports.data = {
	name: "helper",
	description: "Helper Description",

	/**
	 * CHAT_INPUT	1	Slash commands; a text-based command that shows up when a user types /
	 * USER	2	A UI-based command that shows up when you right click or tap on a user
	 * MESSAGE	3	A UI-based command that shows up when you right click or tap on a message
	 * PRIMARY_ENTRY_POINT	4	A UI-based command that represents the primary way to invoke an app's Activity
	 */
	type: 1,

	/**
	 * The parameters for the commands
	 * @links https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure
	 */
	options: [
		{
			name: "opt1",
			description: "Option 1",
			type: 6, // user
			required: true,
		},
		{
			name: "opt2",
			description: "Option 2",
			type: 3, // string
			required: true,
		},
	],

	/**
	 * GUILD_INSTALL	0	App is installable to servers
	 * USER_INSTALL	1	App is installable to users
	 */
	integration_types: [0, 1],

	/**
	 * GUILD	0	Interaction can be used within servers
	 * BOT_DM	1	Interaction can be used within DMs with the app's bot user
	 * PRIVATE_CHANNEL	2	Interaction can be used within Group DMs and DMs other than the app's bot user
	 */
	contexts: [0, 1, 2],

	/**
	 * A permission bit set representing the default permissions required to use the command.
	 * Set to "0" to make the command only usable by administrators.
	 * @links https://discord.com/developers/docs/topics/permissions
	 */
	default_member_permissions: "0", // only administrators

	//etc..:
	category: "musix", //for { player } in execute, run function
	lock: true, // only host control
	ckeckVoice: true, // check voice channel
	enable: true, // enable or disable command
	alias: ["cmd1", "cmd2"],
};

/**
 * @param { object } command - interaction command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang, player }) => {
	// Your code here...
	return interaction.reply({ content: "This is a helper command.", ephemeral: true });
};

/**
 * @param { object } command - message command
 * @param { import ("zihooks").CommandInteraction } command.message - message
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.run = async ({ message, args, lang }) => {
	// Your code here...
	return message.reply({ content: "This is a helper command in message context.", ephemeral: true });
};
