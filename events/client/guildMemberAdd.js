const { Events, GuildMember } = require("discord.js");
const { sendGreeting } = require("../../utility/sendGreeting");

module.exports = {
	name: Events.GuildMemberAdd,
	type: "events",
	/**
	 * @param {GuildMember} member
	 */
	execute: async (member) => sendGreeting(member, "welcome"),
};
