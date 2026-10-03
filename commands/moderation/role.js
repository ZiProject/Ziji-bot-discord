const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "role",
	description: "Quản lý role cho người dùng",
	type: 1, // slash command
	options: [
		{
			name: "add",
			description: "Cấp role cho người dùng",
			type: 1,
			options: [
				{
					name: "user",
					description: "Người dùng cần cấp role",
					type: 6, // user
					required: true,
				},
				{
					name: "role",
					description: "Role cần cấp",
					type: 8, // role
					required: true,
				},
				{
					name: "reason",
					description: "Lý do cấp role",
					type: 3, // string
					required: false,
				},
			],
		},
		{
			name: "remove",
			description: "Gỡ role khỏi người dùng",
			type: 1,
			options: [
				{
					name: "user",
					description: "Người dùng cần gỡ role",
					type: 6, // user
					required: true,
				},
				{
					name: "role",
					description: "Role cần gỡ",
					type: 8, // role
					required: true,
				},
				{
					name: "reason",
					description: "Lý do gỡ role",
					type: 3, // string
					required: false,
				},
			],
		},
		{
			name: "auto",
			description: "Quản lý auto role (tự động cấp role khi tham gia)",
			type: 2, // SUB_COMMAND_GROUP
			options: [
				{
					name: "setup",
					description: "Thiết lập auto role",
					type: 1,
					options: [
						{
							name: "role",
							description: "Role cần thêm/xóa khỏi auto role",
							type: 8, // role
							required: true,
						},
						{
							name: "action",
							description: "Hành động (thêm hoặc xóa)",
							type: 3,
							choices: [
								{ name: "add", value: "add" },
								{ name: "remove", value: "remove" },
							],
							required: true,
						},
					],
				},
				{
					name: "enable",
					description: "Bật hoặc tắt auto role",
					type: 1,
					options: [
						{
							name: "state",
							description: "Bật hoặc tắt auto role",
							type: 5, // boolean
							required: true,
						},
					],
				},
				{
					name: "list",
					description: "Xem danh sách auto role hiện tại",
					type: 1,
				},
			],
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	if (!interaction.guild) {
		return interaction.reply({
			content: lang?.until?.noGuild || "Lệnh này chỉ có thể sử dụng trong máy chủ (server)!",
			ephemeral: true,
		});
	}

	const subcommand = interaction.options.getSubcommand(false);
	const subcommandGroup = interaction.options.getSubcommandGroup(false);

	// Kiểm tra quyền ManageRoles cho các lệnh quản lý role
	if (subcommand !== "list" && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
		return interaction.reply({ content: lang?.until?.noPermission || "Bạn không có quyền quản lý role!", ephemeral: true });
	}

	// Kiểm tra bot có quyền ManageRoles không
	if (subcommand !== "list" && !interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
		return interaction.reply({
			content: lang?.until?.NOPermission || "Bot không có quyền quản lý role!",
			ephemeral: true,
		});
	}

	// Xử lý auto role
	if (subcommandGroup === "auto") {
		const database = useHooks.get("db");
		if (!database) {
			return interaction.reply({
				content: lang?.until?.noDB || "Database hiện không được bật, xin vui lòng liên hệ dev bot",
				ephemeral: true,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (subcommand === "setup") {
			const role = interaction.options.getRole("role");
			const action = interaction.options.getString("action");

			// Kiểm tra role có phải là @everyone không
			if (role.id === interaction.guild.id) {
				return interaction.editReply({ content: lang?.role?.auto?.cannotUseEveryone || "Không thể sử dụng role @everyone!" });
			}

			// Kiểm tra role có thể quản lý được không
			if (role.position >= interaction.guild.members.me.roles.highest.position) {
				return interaction.editReply({
					content:
						lang?.role?.auto?.botRoleTooLow || "Bot không thể quản lý role này vì role của bot thấp hơn hoặc bằng role này.",
				});
			}

			// Kiểm tra người dùng có quyền quản lý role này không (tránh leo thang đặc quyền qua auto role)
			if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
				return interaction.editReply({
					content: lang?.role?.userRoleTooLow || "Bạn không thể quản lý role này vì role của bạn thấp hơn hoặc bằng role này.",
				});
			}

			let guildSetting = await database.ZiGuild.findOne({ guildId: interaction.guild.id });
			if (!guildSetting) {
				guildSetting = new database.ZiGuild({
					guildId: interaction.guild.id,
					autoRole: { enabled: false, roleIds: [] },
				});
			}

			if (!guildSetting.autoRole) {
				guildSetting.autoRole = { enabled: false, roleIds: [] };
			}

			if (action === "add") {
				if (guildSetting.autoRole.roleIds.includes(role.id)) {
					return interaction.editReply({
						content: lang?.role?.auto?.alreadyAdded || `Role **${role.name}** đã có trong danh sách auto role!`,
					});
				}
				guildSetting.autoRole.roleIds.push(role.id);
				await guildSetting.save();
				interaction.editReply({
					content: lang?.role?.auto?.added || `✅ Đã thêm role **${role.name}** vào danh sách auto role!`,
				});
			} else if (action === "remove") {
				if (!guildSetting.autoRole.roleIds.includes(role.id)) {
					return interaction.editReply({
						content: lang?.role?.auto?.notInList || `Role **${role.name}** không có trong danh sách auto role!`,
					});
				}
				guildSetting.autoRole.roleIds = guildSetting.autoRole.roleIds.filter((id) => id !== role.id);
				await guildSetting.save();
				interaction.editReply({
					content: lang?.role?.auto?.removed || `✅ Đã xóa role **${role.name}** khỏi danh sách auto role!`,
				});
			}
		} else if (subcommand === "enable") {
			const state = interaction.options.getBoolean("state");
			let guildSetting = await database.ZiGuild.findOne({ guildId: interaction.guild.id });
			if (!guildSetting) {
				guildSetting = new database.ZiGuild({
					guildId: interaction.guild.id,
					autoRole: { enabled: state, roleIds: [] },
				});
			}

			if (!guildSetting.autoRole) {
				guildSetting.autoRole = { enabled: state, roleIds: [] };
			} else {
				guildSetting.autoRole.enabled = state;
			}

			await guildSetting.save();
			interaction.editReply({
				content:
					state === true ?
						lang?.role?.auto?.enabled ||
						`✅ Đã bật auto role!${guildSetting.autoRole.roleIds.length === 0 ? "\n⚠️ Chưa có role nào trong danh sách, hãy dùng `/role auto setup` để thêm role." : ""}`
					:	lang?.role?.auto?.disabled || "✅ Đã tắt auto role!",
			});
		} else if (subcommand === "list") {
			const guildSetting = await database.ZiGuild.findOne({ guildId: interaction.guild.id });
			if (!guildSetting?.autoRole || !guildSetting.autoRole.roleIds || guildSetting.autoRole.roleIds.length === 0) {
				return interaction.editReply({
					content: lang?.role?.auto?.noRoles || "❌ Chưa có role nào trong danh sách auto role!",
				});
			}

			const rolesList = [];
			for (const roleId of guildSetting.autoRole.roleIds) {
				const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
				if (role) {
					rolesList.push(`• ${role} (${role.name})`);
				} else {
					rolesList.push(`• <@&${roleId}> (Role đã bị xóa)`);
				}
			}

			const embed = new EmbedBuilder()
				.setTitle(lang?.role?.auto?.listTitle || "📋 Danh sách Auto Role")
				.setDescription(rolesList.join("\n"))
				.setColor("Random")
				.setFooter({
					text: lang?.role?.auto?.listFooter || `Trạng thái: ${guildSetting.autoRole.enabled ? "✅ Đã bật" : "❌ Đã tắt"}`,
				})
				.setTimestamp();

			interaction.editReply({ embeds: [embed] });
		}
		return;
	}

	// Xử lý add/remove role cho user
	const user = interaction.options.getUser("user");
	const role = interaction.options.getRole("role");
	const reason = interaction.options.getString("reason") || lang?.role?.noReason || "Không có lý do";

	// Lấy member từ guild
	const member = await interaction.guild.members.fetch(user.id).catch(() => null);
	if (!member) {
		return interaction.reply({ content: lang?.role?.userNotFound || "Không tìm thấy người dùng trong server.", ephemeral: true });
	}

	// Kiểm tra role có tồn tại không
	if (!role) {
		return interaction.reply({ content: lang?.role?.roleNotFound || "Không tìm thấy role.", ephemeral: true });
	}

	// Kiểm tra role có thể quản lý được không (role của bot phải cao hơn role cần cấp)
	if (role.position >= interaction.guild.members.me.roles.highest.position) {
		return interaction.reply({
			content: lang?.role?.botRoleTooLow || "Bot không thể quản lý role này vì role của bot thấp hơn hoặc bằng role cần cấp.",
			ephemeral: true,
		});
	}

	// Kiểm tra người dùng có quyền quản lý role này không (role của người dùng phải cao hơn role cần cấp)
	if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
		return interaction.reply({
			content: lang?.role?.userRoleTooLow || "Bạn không thể quản lý role này vì role của bạn thấp hơn hoặc bằng role cần cấp.",
			ephemeral: true,
		});
	}

	// Kiểm tra role có phải là @everyone không
	if (role.id === interaction.guild.id) {
		return interaction.reply({ content: lang?.role?.cannotUseEveryone || "Không thể quản lý role @everyone!", ephemeral: true });
	}

	try {
		if (subcommand === "add") {
			// Kiểm tra user đã có role chưa
			if (member.roles.cache.has(role.id)) {
				return interaction.reply({
					content:
						lang?.role?.alreadyHasRole?.replace("{user}", user.tag)?.replace("{role}", role.name) ||
						`${user.tag} đã có role ${role.name} rồi!`,
					ephemeral: true,
				});
			}

			// Cấp role
			await member.roles.add(role, reason);
			interaction.reply({
				content:
					lang?.role?.added?.replace("{role}", role.name)?.replace("{user}", user.tag)?.replace("{reason}", reason) ||
					`✅ Đã cấp role **${role.name}** cho ${user.tag}${reason !== (lang?.role?.noReason || "Không có lý do") ? `\n📝 Lý do: ${reason}` : ""}`,
			});
		} else if (subcommand === "remove") {
			// Kiểm tra user có role chưa
			if (!member.roles.cache.has(role.id)) {
				return interaction.reply({
					content:
						lang?.role?.doesNotHaveRole?.replace("{user}", user.tag)?.replace("{role}", role.name) ||
						`${user.tag} không có role ${role.name}!`,
					ephemeral: true,
				});
			}

			// Gỡ role
			await member.roles.remove(role, reason);
			interaction.reply({
				content:
					lang?.role?.removed?.replace("{role}", role.name)?.replace("{user}", user.tag)?.replace("{reason}", reason) ||
					`✅ Đã gỡ role **${role.name}** khỏi ${user.tag}${reason !== (lang?.role?.noReason || "Không có lý do") ? `\n📝 Lý do: ${reason}` : ""}`,
			});
		}
	} catch (error) {
		console.error("Lỗi khi quản lý role:", error);
		interaction.reply({
			content: `❌ Đã xảy ra lỗi khi ${subcommand === "add" ? "cấp" : "gỡ"} role: ${error.message}`,
			ephemeral: true,
		});
	}
};
