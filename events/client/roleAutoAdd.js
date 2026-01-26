const { useHooks } = require("zihooks");
const { Events, GuildMember, AttachmentBuilder } = require("discord.js");

module.exports = {
	name: Events.GuildMemberAdd,
	type: "events",
	/**
	 *
	 * @param { GuildMember } member
	 */
	execute: async (member) => {
		// Auto role
		const database = useHooks.get("db");
		if (!database) return;

		const guildSetting = await database.ZiGuild.findOne({ guildId: member.guild.id });
		if (!guildSetting?.autoRole?.enabled) return;
		if (!guildSetting?.autoRole?.roleIds?.length) return;

		const rolesToAdd = [];
		for (const roleId of guildSetting.autoRole.roleIds) {
			const role = await member.guild.roles.fetch(roleId).catch(() => null);
			if (role && role.position < member.guild.members.me.roles.highest.position) {
				rolesToAdd.push(role);
			}
		}
		if (rolesToAdd.length > 0) {
			await member.roles.add(rolesToAdd, "Auto role khi tham gia server");
		}
	},
};
