const { Client, Events, Message, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const { useHooks, modinteraction } = require("zihooks");
const fs = require("fs");
const path = require("path");
const Cooldowns = useHooks.get("cooldowns");
const Commands = useHooks.get("Mcommands");
const Functions = useHooks.get("functions");
const config = useHooks.get("config");
const { getPlayer } = require("ziplayer");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

/**
 *
 * @param { import("zihooks").CommandInteraction } message
 * @param { Client } client
 * @param { import("./../../lang/vi.js") } lang
 * @returns
 */
async function checkStatus(message, client, lang) {
	// Check permission
	if (message.guild) {
		const hasPermission = message.channel
			.permissionsFor(client.user)
			.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);

		if (!hasPermission) {
			await message.reply({ content: lang.until.NOPermission, ephemeral: true });
			return true;
		}
	}
	// Check banned
	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	}
	let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
	if (devConfig.bannedUsers.includes(message.author.id)) {
		await message
			.reply({
				content: lang.until.banned,
				flags: MessageFlags.Ephemeral,
			})
			.catch(() => {});
		return true;
	}

	// Check owner
	if (config.OwnerID.includes(message.author.id)) return false;

	// Check cooldown
	const now = Date.now();
	const cooldownDuration = config.defaultCooldownDuration ?? 3000;
	const expirationTime = Cooldowns.get(message.author.id) + cooldownDuration;

	if (Cooldowns.has(message.author.id) && now < expirationTime) {
		const expiredTimestamp = Math.round(expirationTime / 1_000);
		await message
			.reply({
				content: lang.until.cooldown
					.replace("{command}", message.commandName || message.customId)
					.replace("{time}", `<t:${expiredTimestamp}:R>`),
				ephemeral: true,
			})
			.catch(() => {});
		return true;
	}
	// Set cooldown
	Cooldowns.set(message.author.id, now);
	setTimeout(() => Cooldowns.delete(message.author.id), cooldownDuration);
	return false;
}

/**
 * @param { object } fns
 * @param { Message } fns.message
 * @param { object } fns.command
 * @param { import("./../../lang/vi.js") } fns.lang
 */
async function checkMusicstat({ message, command, lang }) {
	let ops = {
		status: false,
	};

	if (!message?.guild) {
		await message.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription(`${lang.until.noGuild} `)] });
		return ops;
	}
	const voiceChannel = message.member?.voice?.channel;
	const player = getPlayer(`${message.guild.id}::${voiceChannel?.id}`);

	ops.player = player;
	if (command?.lock) {
		if (!player?.connection) {
			await message.reply({ content: lang.music.NoPlaying, ephemeral: true });
			return ops;
		}
		// Kiểm tra xem có khóa player không
		if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== message.author?.id) {
			await message.reply({ content: lang.until.noPermission, ephemeral: true });
			return ops;
		}
	}
	if (command?.ckeckVoice) {
		const botVoiceChannel = message.guild.members.me.voice.channel;
		const userVoiceChannel = message.member.voice.channel;
		if (userVoiceChannel) {
			await message.reply({ content: lang.music.NOvoiceMe, ephemeral: true });
			return ops;
		}
	}
	ops.status = true;
	return ops;
}

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
	if (!message.client.isReady()) return;

	if (message.author.bot) return;

	const prefix = config?.prefix || "z!";

	if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = Commands.get(args.shift().toLowerCase());

	if (!command) return;
	// Get the user's language preference
	const langfunc = Functions.get("ZiRank");

	const lang = await langfunc.execute({ user: message.author, XpADD: 1 });

	modinteraction(message);

	const commandStatus = await checkStatus(message, message.client, lang);

	if (commandStatus) return;
	if (command.data?.default_member_permissions && command.data.default_member_permissions === "0") {
		//check member
		if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
			return message.reply({ content: lang.until.noPermission, ephemeral: true });
		}
	}

	try {
		useHooks
			.get("logger")
			.debug(
				`Messenger received: ${command.data.name} >> User: ${message.author?.username} >> Guild: ${message?.guild?.name} (${message?.guildId})`,
			);

		let cmdops = null;
		if (command?.data.category == "musix") {
			const sts = await checkMusicstat({ message, command, lang });
			if (!sts.status) return;
			cmdops = sts;
		}

		message.getFlag = (name) => {
			const index = args.indexOf(`${config.Moptions || "--"}${name}`);
			if (index === -1) return null;
			const value = args[index + 1];
			args.splice(index, 2);
			return value ?? null;
		};

		if (command.run) {
			await command.run({ message, args, lang, ...cmdops });
		} else if (command.execute) {
			const options = {
				_options: {},
				_subcommand: null,
				getSubcommand: function () {
					return this._subcommand;
				},
				get: function (name) {
					const val = this._options[name];
					return val !== undefined ? { value: val, user: val, member: val, role: val, channel: val } : null;
				},
				getString: function (name) {
					const val = this._options[name];
					return val !== undefined ? String(val) : null;
				},
				getUser: function (name) {
					const val = this._options[name];
					return val && val.id ? val : null;
				},
				getMember: function (name) {
					const user = this.getUser(name);
					return user ? message.guild?.members.cache.get(user.id) : null;
				},
				getBoolean: function (name) {
					const val = this._options[name];
					return val === true || val === "true";
				},
				getInteger: function (name) {
					const val = parseInt(this._options[name]);
					return isNaN(val) ? null : val;
				},
				getChannel: function (name) {
					const val = this._options[name];
					return val && val.id ? val : null;
				},
				getRole: function (name) {
					const val = this._options[name];
					return val && val.id ? val : null;
				},
				getMentionable: function (name) {
					return this._options[name] || null;
				},
				getNumber: function (name) {
					const val = parseFloat(this._options[name]);
					return isNaN(val) ? null : val;
				},
				getAttachment: function (name) {
					return message.attachments.first() || null;
				},
			};

			const commandData = command.data;
			let currentArgs = [...args];

			if (commandData.options && commandData.options.length > 0) {
				const firstOption = commandData.options[0];
				if (firstOption.type === 1 || firstOption.type === 2) {
					// Subcommand or SubcommandGroup
					const subName = currentArgs.shift()?.toLowerCase();
					const subData = commandData.options.find((o) => o.name.toLowerCase() === subName);
					if (subData) {
						options._subcommand = subData.name;
						if (subData.options) {
							subData.options.forEach((opt, index) => {
								if (opt.type === 3) {
									// STRING
									options._options[opt.name] = currentArgs.slice(index).join(" ");
								} else if (opt.type === 6) {
									// USER
									options._options[opt.name] = message.mentions.users.at(index) || message.mentions.users.first();
								} else if (opt.type === 5 || opt.type === 4) {
									// BOOLEAN or INTEGER
									options._options[opt.name] = currentArgs[index];
								}
							});
						}
					} else {
						currentArgs.unshift(subName);
					}
				} else {
					// Root options
					commandData.options.forEach((opt, index) => {
						if (opt.type === 3) {
							options._options[opt.name] = currentArgs.slice(index).join(" ");
						} else if (opt.type === 6) {
							options._options[opt.name] = message.mentions.users.at(index) || message.mentions.users.first();
						} else if (opt.type === 5 || opt.type === 4) {
							// BOOLEAN or INTEGER
							options._options[opt.name] = currentArgs[index];
						}
					});
				}
			}

			message.options = options;
			await command.execute({ interaction: message, lang, ...cmdops });
		}
	} catch (error) {
		console.error(`Error executing message command ${command.data.name}:`, error);
	}
};
