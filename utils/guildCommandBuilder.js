const { ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { buildContainerFromLayout, DEFAULT_LAYOUT } = require("./guildCommandComponents");

const builderSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

const getSessionKey = (userId, guildId) => `${guildId}:${userId}`;

const cleanupSessions = () => {
	const now = Date.now();
	for (const [key, session] of builderSessions.entries()) {
		if (now - session.updatedAt > SESSION_TTL_MS) builderSessions.delete(key);
	}
};

const getBuilderSession = (userId, guildId) => {
	cleanupSessions();
	return builderSessions.get(getSessionKey(userId, guildId)) || null;
};

const setBuilderSession = (userId, guildId, session) => {
	builderSessions.set(getSessionKey(userId, guildId), { ...session, updatedAt: Date.now() });
};

const clearBuilderSession = (userId, guildId) => {
	builderSessions.delete(getSessionKey(userId, guildId));
};

const startBuilderSession = ({ userId, guildId, commandName, layout, isNew = false }) => {
	const session = {
		userId,
		guildId,
		commandName,
		layout: layout || DEFAULT_LAYOUT(),
		isNew,
		updatedAt: Date.now(),
	};
	setBuilderSession(userId, guildId, session);
	return session;
};

const buildBuilderPreview = (session, context = {}) => {
	const container = buildContainerFromLayout(session.layout, context);
	container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));
	container.addTextDisplayComponents((text) =>
		text.setContent(`-# Builder: \`/${session.commandName}\`${session.isNew ? " *(mới — chưa lưu)*" : ""}`),
	);
	container.addActionRowComponents((row) =>
		row.addComponents(
			new ButtonBuilder().setCustomId("B_guildcmd_addtext").setLabel("＋ Text").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("B_guildcmd_addsep").setLabel("＋ Separator").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("B_guildcmd_setcolor").setLabel("🎨 Màu").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("B_guildcmd_preview").setLabel("↻ Preview").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("B_guildcmd_save").setLabel("💾 Lưu").setStyle(ButtonStyle.Success),
		),
	);

	return {
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		components: [container],
	};
};

module.exports = {
	getBuilderSession,
	setBuilderSession,
	clearBuilderSession,
	startBuilderSession,
	buildBuilderPreview,
};
