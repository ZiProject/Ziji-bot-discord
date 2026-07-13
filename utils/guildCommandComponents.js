const {
	MessageFlags,
	ContainerBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");

const MAX_TEXT_LENGTH = 4000;
const MAX_BLOCKS = 40;
const MAX_BUTTONS = 5;
const ALLOWED_BLOCK_TYPES = new Set(["text", "separator", "section", "buttons", "media"]);
const BUTTON_STYLES = {
	primary: ButtonStyle.Primary,
	secondary: ButtonStyle.Secondary,
	success: ButtonStyle.Success,
	danger: ButtonStyle.Danger,
	link: ButtonStyle.Link,
};

const sanitizeText = (value, maxLength) => {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, maxLength);
};

const isSafeUrl = (url) => typeof url === "string" && /^https?:\/\//i.test(url.trim());

const normalizeAccentColor = (color) => {
	if (!Array.isArray(color) || color.length !== 3) return [88, 101, 242];
	return color.map((value) => Math.max(0, Math.min(255, Number(value) || 0)));
};

const applyPlaceholders = (content, context = {}) => {
	if (!content) return content;
	const { user, guild } = context;
	return content
		.replaceAll("{user}", user ? `<@${user.id}>` : "")
		.replaceAll("{user.name}", user?.username || "")
		.replaceAll("{user.id}", user?.id || "")
		.replaceAll("{guild}", guild?.name || "")
		.replaceAll("{guild.name}", guild?.name || "")
		.replaceAll("{guild.id}", guild?.id || "")
		.replaceAll("{memberCount}", guild?.memberCount ? String(guild.memberCount) : "");
};

const validateComponentsLayout = (layout) => {
	if (!layout || typeof layout !== "object") {
		return { ok: false, error: "Layout Components V2 phải là object JSON hợp lệ." };
	}

	const blocks = Array.isArray(layout.blocks) ? layout.blocks : [];
	if (!blocks.length) {
		return { ok: false, error: "Layout cần ít nhất một block (text, separator, section, buttons, media)." };
	}
	if (blocks.length > MAX_BLOCKS) {
		return { ok: false, error: `Layout tối đa ${MAX_BLOCKS} block.` };
	}

	const normalizedBlocks = [];
	for (const block of blocks) {
		if (!block || typeof block !== "object" || !ALLOWED_BLOCK_TYPES.has(block.type)) {
			return { ok: false, error: "Mỗi block cần type hợp lệ: text, separator, section, buttons, media." };
		}

		if (block.type === "text") {
			const content = sanitizeText(block.content, MAX_TEXT_LENGTH);
			if (!content) return { ok: false, error: "Block text cần nội dung." };
			normalizedBlocks.push({ type: "text", content });
			continue;
		}

		if (block.type === "separator") {
			normalizedBlocks.push({
				type: "separator",
				divider: block.divider !== false,
				spacing: block.spacing === 2 ? 2 : 1,
			});
			continue;
		}

		if (block.type === "section") {
			const content = sanitizeText(block.content, MAX_TEXT_LENGTH);
			if (!content) return { ok: false, error: "Block section cần nội dung." };
			const section = { type: "section", content };
			if (block.button) {
				const style = BUTTON_STYLES[String(block.button.style || "link").toLowerCase()];
				if (!style) return { ok: false, error: "Button section cần style hợp lệ." };
				if (style === ButtonStyle.Link) {
					const url = block.button.url?.trim();
					if (!isSafeUrl(url)) return { ok: false, error: "Button link cần URL http(s) hợp lệ." };
					section.button = {
						style: "link",
						label: sanitizeText(block.button.label || "Open", 80) || "Open",
						url,
					};
				} else {
					const customId = sanitizeText(block.button.customId, 100);
					if (!customId) return { ok: false, error: "Button section cần customId." };
					section.button = {
						style: String(block.button.style || "secondary").toLowerCase(),
						label: sanitizeText(block.button.label || "Button", 80) || "Button",
						customId,
					};
				}
			}
			normalizedBlocks.push(section);
			continue;
		}

		if (block.type === "buttons") {
			const buttons = Array.isArray(block.buttons) ? block.buttons.slice(0, MAX_BUTTONS) : [];
			if (!buttons.length) return { ok: false, error: "Block buttons cần ít nhất một button." };
			const normalizedButtons = [];
			for (const button of buttons) {
				const style = BUTTON_STYLES[String(button.style || "secondary").toLowerCase()];
				if (!style) return { ok: false, error: "Button cần style hợp lệ." };
				if (style === ButtonStyle.Link) {
					const url = button.url?.trim();
					if (!isSafeUrl(url)) return { ok: false, error: "Button link cần URL http(s) hợp lệ." };
					normalizedButtons.push({
						style: "link",
						label: sanitizeText(button.label || "Open", 80) || "Open",
						url,
					});
				} else {
					const customId = sanitizeText(button.customId, 100);
					if (!customId) return { ok: false, error: "Button cần customId." };
					normalizedButtons.push({
						style: String(button.style || "secondary").toLowerCase(),
						label: sanitizeText(button.label || "Button", 80) || "Button",
						customId,
					});
				}
			}
			normalizedBlocks.push({ type: "buttons", buttons: normalizedButtons });
			continue;
		}

		if (block.type === "media") {
			const url = block.url?.trim();
			if (!isSafeUrl(url)) return { ok: false, error: "Block media cần URL http(s) hợp lệ." };
			normalizedBlocks.push({ type: "media", url });
		}
	}

	return {
		ok: true,
		value: {
			accentColor: normalizeAccentColor(layout.accentColor),
			blocks: normalizedBlocks,
		},
	};
};

const parseComponentsLayout = (raw) => {
	if (!raw) return { ok: false, error: "Layout JSON không được để trống." };
	if (typeof raw === "object") return validateComponentsLayout(raw);
	if (typeof raw !== "string") return { ok: false, error: "Layout phải là JSON string hoặc object." };
	try {
		return validateComponentsLayout(JSON.parse(raw));
	} catch {
		return { ok: false, error: "Layout JSON không hợp lệ." };
	}
};

const buildButton = (button) => {
	const style = BUTTON_STYLES[button.style] ?? ButtonStyle.Secondary;
	const builder = new ButtonBuilder().setStyle(style).setLabel(button.label || "Button");
	if (style === ButtonStyle.Link) builder.setURL(button.url);
	else builder.setCustomId(button.customId);
	return builder;
};

const buildContainerFromLayout = (layout, context = {}) => {
	const container = new ContainerBuilder().setAccentColor(normalizeAccentColor(layout.accentColor));
	for (const block of layout.blocks || []) {
		if (block.type === "text") {
			container.addTextDisplayComponents((text) => text.setContent(applyPlaceholders(block.content, context)));
			continue;
		}
		if (block.type === "separator") {
			container.addSeparatorComponents((separator) =>
				separator.setDivider(block.divider !== false).setSpacing(block.spacing === 2 ? 2 : 1),
			);
			continue;
		}
		if (block.type === "section") {
			container.addSectionComponents((section) => {
				section.addTextDisplayComponents((text) => text.setContent(applyPlaceholders(block.content, context)));
				if (block.button) {
					section.setButtonAccessory((button) => {
						const style = BUTTON_STYLES[block.button.style] ?? ButtonStyle.Secondary;
						button.setStyle(style).setLabel(block.button.label || "Button");
						if (style === ButtonStyle.Link) button.setURL(block.button.url);
						else button.setCustomId(block.button.customId);
					});
				}
				return section;
			});
			continue;
		}
		if (block.type === "buttons") {
			container.addActionRowComponents((row) => row.addComponents(...block.buttons.map(buildButton)));
			continue;
		}
		if (block.type === "media") {
			container.addMediaGalleryComponents((gallery) =>
				gallery.addItems((item) => item.setURL(block.url)),
			);
		}
	}
	return container;
};

const buildComponentsReply = (layout, context = {}) => ({
	flags: MessageFlags.IsComponentsV2,
	components: [buildContainerFromLayout(layout, context)],
});

const DEFAULT_LAYOUT = () => ({
	accentColor: [88, 101, 242],
	blocks: [{ type: "text", content: "## Tiêu đề\nNội dung tin nhắn Components V2" }],
});

module.exports = {
	MAX_TEXT_LENGTH,
	MAX_BLOCKS,
	validateComponentsLayout,
	parseComponentsLayout,
	buildContainerFromLayout,
	buildComponentsReply,
	applyPlaceholders,
	DEFAULT_LAYOUT,
};
