const {
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SectionBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require("discord.js");
const { useHooks } = require("zihooks");
const os = require("os");

module.exports.data = {
	name: "systemstats",
	description: "Xem thông tin RAM, CPU và cache size của bot",
	type: 1,
	options: [],
	integration_types: [0],
	contexts: [0, 1],
	owner: true,
};

/**
 * @param { object } command
 * @param { import("discord.js").CommandInteraction } command.interaction
 * @param { import('../../lang/vi.js') } command.lang
 */
module.exports.execute = async ({ interaction, lang }) => {
	const config = useHooks.get("config");

	if (!config?.OwnerID?.length || !config.OwnerID.includes(interaction.user.id)) {
		return interaction.reply({
			content: lang?.until?.noPermission || "Bạn không có quyền sử dụng lệnh này.",
			ephemeral: true,
		});
	}

	await interaction.deferReply();

	// ─── Gather stats ────────────────────────────────────────────────────
	const cpuUsagePercent = await getCpuUsage();

	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const usedMem = totalMem - freeMem;
	const procMem = process.memoryUsage();

	const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
	const fmtGB = (b) => `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
	const pct = (u, t) => `${((u / t) * 100).toFixed(1)}%`;

	const cpuModel = os.cpus()[0]?.model?.trim() || "Unknown CPU";
	const cpuCores = os.cpus().length;
	const nodeVer = process.version;
	const platform = `${os.type()} ${os.arch()}`;
	const uptimeStr = formatUptime(process.uptime());
	const wsPing = interaction.client.ws.ping;

	// ─── useHooks cache sizes ─────────────────────────────────────────────
	const hookEntries = [];
	for (const [key, value] of useHooks.entries()) {
		const size = getCacheSize(value);
		const sizeMB = getObjectSizeMB(value);
		if (size !== null) hookEntries.push({ key, size, sizeMB });
	}
	hookEntries.sort((a, b) => b.size - a.size);
	const totalCacheMB = hookEntries.reduce((sum, x) => sum + x.sizeMB, 0);

	// ─── Build progress bars ──────────────────────────────────────────────
	const cpuBar = buildBar(cpuUsagePercent, 100);
	const ramBarSys = buildBar(usedMem, totalMem);
	const ramBarProc = buildBar(procMem.heapUsed, procMem.heapTotal);

	// ─── ComponentsV2 layout ─────────────────────────────────────────────
	const container = new ContainerBuilder().setAccentColor([0, 180, 216]); // cyan accent

	// Header
	container.addTextDisplayComponents((t) => t.setContent(`## 🖥️ System Stats\n-# Node.js ${nodeVer} • ${platform}`));

	container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(1));

	// CPU block
	container.addTextDisplayComponents((t) =>
		t.setContent(
			[`**⚡ CPU**`, `\`\`\`${cpuModel} (${cpuCores} cores)\`\`\``, `${cpuBar} **${cpuUsagePercent.toFixed(1)}%**`].join("\n"),
		),
	);

	container.addSeparatorComponents((s) => s.setDivider(false).setSpacing(1));

	// RAM — side by side via two text blocks
	container.addTextDisplayComponents((t) =>
		t.setContent(
			[
				`**🧠 System RAM**`,
				`${ramBarSys} **${pct(usedMem, totalMem)}**`,
				`Used **${fmtGB(usedMem)}** / Total **${fmtGB(totalMem)}**`,
			].join("\n"),
		),
	);

	container.addTextDisplayComponents((t) =>
		t.setContent(
			[
				`**📦 Process Heap**`,
				`${ramBarProc} **${pct(procMem.heapUsed, procMem.heapTotal)}**`,
				`Heap **${fmtMB(procMem.heapUsed)}** / **${fmtMB(procMem.heapTotal)}** • RSS **${fmtMB(procMem.rss)}**`,
			].join("\n"),
		),
	);

	container.addSeparatorComponents((s) => s.setDivider(false).setSpacing(1));

	// Quick stats row (uptime / ping)
	container.addTextDisplayComponents((t) =>
		t.setContent([`**⏱️ Uptime:** \`${uptimeStr}\`　　**🏓 WS Ping:** \`${wsPing} ms\``].join("\n")),
	);

	container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(1));

	// useHooks cache table
	const cacheHeader = `**🗂️ useHooks Cache** — ${hookEntries.length} keys • ${totalCacheMB.toFixed(2)} KB`;
	// Split into columns of max 15 entries each to stay within 2000-char limit
	const chunkSize = 15;
	const chunks = [];
	for (let i = 0; i < hookEntries.length; i += chunkSize) {
		chunks.push(hookEntries.slice(i, i + chunkSize));
	}

	if (chunks.length === 0) {
		container.addTextDisplayComponents((t) => t.setContent(`${cacheHeader}\n*No sized caches found*`));
	} else {
		container.addTextDisplayComponents((t) => t.setContent(cacheHeader));
		for (const chunk of chunks) {
			const lines = chunk
				.map(({ key, size, sizeMB }) => `\`${key.padEnd(20)}\`   ${size}   •   ${sizeMB.toFixed(2)} KB`)
				.join("\n");
			container.addTextDisplayComponents((t) => t.setContent(lines));
		}
	}

	container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(1));

	// Footer / refresh button
	container.addActionRowComponents((row) =>
		row.addComponents(new ButtonBuilder().setCustomId("B_cancel").setLabel("✕ Close").setStyle(ButtonStyle.Secondary)),
	);

	await interaction.editReply({
		flags: MessageFlags.IsComponentsV2,
		components: [container],
	});
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCacheSize(value) {
	if (value == null) return null;
	// Discord Collection / Map / Set
	if (typeof value.size === "number") return value.size;
	// Array
	if (Array.isArray(value)) return value.length;
	// WebSocket server (wss.clients is a Set)
	if (value?.clients?.size !== undefined) return value.clients.size;
	// Map-like with keys()
	if (typeof value.keys === "function") {
		try {
			return [...value.keys()].length;
		} catch {
			return null;
		}
	}
	// Plain object
	if (typeof value === "object" && !Buffer.isBuffer(value)) {
		try {
			return Object.keys(value).length;
		} catch {
			return null;
		}
	}
	return null;
}

function getCpuUsage() {
	return new Promise((resolve) => {
		const start = cpuTimes();
		setTimeout(() => {
			const end = cpuTimes();
			const idle = end.idle - start.idle;
			const total = end.total - start.total;
			resolve(total === 0 ? 0 : Math.min(100, ((total - idle) / total) * 100));
		}, 500);
	});
}

function cpuTimes() {
	let idle = 0,
		total = 0;
	for (const cpu of os.cpus()) {
		for (const v of Object.values(cpu.times)) total += v;
		idle += cpu.times.idle;
	}
	return { idle, total };
}

function buildBar(used, total, width = 12) {
	const filled = Math.round((Math.min(used, total) / total) * width);
	return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

function formatUptime(sec) {
	const d = Math.floor(sec / 86400);
	const h = Math.floor((sec % 86400) / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ");
}

function getObjectSizeMB(obj) {
	try {
		const bytes = Buffer.byteLength(
			JSON.stringify(obj, (_, v) => {
				if (typeof v === "bigint") return v.toString();
				return v;
			}),
		);

		return bytes / 1024;
	} catch {
		return 0;
	}
}
