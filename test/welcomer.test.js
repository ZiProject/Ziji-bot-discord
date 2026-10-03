const assert = require("node:assert/strict");
const { test } = require("node:test");
const { MessageFlags, PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");
const welcomer = require("../commands/moderation/welcomer");
const { sendGreeting, getMissingGreetingPermissions } = require("../utility/sendGreeting");

test("welcomer exposes edit, preview, and help subcommands", () => {
	const subcommands = welcomer.data.options.map((option) => option.name);
	assert.deepEqual(subcommands, ["setup", "edit", "preview", "help"]);

	const editOptions = welcomer.data.options.find((option) => option.name === "edit").options;
	assert.deepEqual(
		editOptions.find((option) => option.name === "type").choices.map((choice) => choice.value),
		["welcome", "goodbye"],
	);
	assert.equal(editOptions.find((option) => option.name === "animation").required, true);
});

test("welcomer help uses Components V2 and links the editor and guide images", async () => {
	let response;
	await welcomer.showHelp({
		editReply: async (payload) => {
			response = payload;
		},
	});

	assert.equal(response.flags, MessageFlags.IsComponentsV2);
	const helpComponents = JSON.stringify(response.components[0].toJSON());
	assert.match(helpComponents, /https:\/\/image-studio-green\.vercel\.app\/animation/);
	assert.match(helpComponents, /1555999339451650118\/image\.png/);
	assert.match(helpComponents, /1556000319295717437\/image\.png/);
	assert.match(helpComponents, /\{userAVTurl\}.*\{userName\}.*\{guildName\}/);
});

test("welcomer edit saves uploaded animation and preserves other settings", async (t) => {
	const originalFetch = global.fetch;
	t.after(() => {
		global.fetch = originalFetch;
	});

	const animation = {
		type: "animated",
		data: {
			format: "gif",
			tracks: [{ elementId: "avatar", keyframes: [{ time: 0 }] }],
		},
	};
	global.fetch = async (url) => {
		assert.equal(url, "https://cdn.example.invalid/welcome.json");
		return new Response(JSON.stringify(animation), { status: 200 });
	};

	const existing = {
		channel: "welcome-channel",
		content: JSON.stringify({ description: "Welcome {userName}" }),
		Bchannel: "goodbye-channel",
		Bcontent: JSON.stringify({ description: "Bye {userName}" }),
	};
	let savedRecord;
	let cachedRecord;
	let response;
	const db = {
		ZiWelcome: {
			findOne: async ({ guildId }) => {
				assert.equal(guildId, "guild-id");
				return existing;
			},
			updateOne: async (filter, update, options) => {
				assert.deepEqual(filter, { guildId: "guild-id" });
				assert.deepEqual(options, { upsert: true });
				savedRecord = update.$set;
			},
		},
	};
	const Welcome = {
		set: (guildId, records) => {
			assert.equal(guildId, "guild-id");
			cachedRecord = records[0];
		},
	};

	await welcomer.editAnimation({
		interaction: {
			guild: { id: "guild-id" },
			editReply: async (payload) => {
				response = payload;
			},
		},
		db,
		Welcome,
		type: "welcome",
		animation: { url: "https://cdn.example.invalid/welcome.json" },
	});

	assert.equal(JSON.parse(savedRecord.content).description, "Welcome {userName}");
	assert.deepEqual(JSON.parse(savedRecord.content).animation, animation);
	assert.equal(savedRecord.Bcontent, existing.Bcontent);
	assert.equal(savedRecord.channel, existing.channel);
	assert.equal(savedRecord.Bchannel, existing.Bchannel);
	assert.deepEqual(cachedRecord, savedRecord);
	assert.match(response.content, /Đã cập nhật animation chào mừng/);
});

test("welcomer preview sends the rendered card to the chosen channel", async (t) => {
	const originalFetch = global.fetch;
	const previousWelcome = useHooks.get("welcome");
	const previousFunctions = useHooks.get("functions");
	const previousConfig = useHooks.get("config");
	t.after(() => {
		global.fetch = originalFetch;
		useHooks.set("welcome", previousWelcome);
		useHooks.set("functions", previousFunctions);
		useHooks.set("config", previousConfig);
	});

	global.fetch = async () => new Response(Buffer.from("GIF89a\u0001\u0000\u0001\u0000"), { status: 200 });
	useHooks.set("welcome", new Map([["guild-id", [{ content: JSON.stringify({ title: "Hi {userName}" }) }]]]));
	useHooks.set("functions", {
		get: () => ({
			execute: (value) => value?.replace("{userName}", "Tester"),
		}),
	});
	useHooks.set("config", { defaultColor: 0x123456 });

	let sentPayload;
	let shouldAbortUpload = false;
	const member = {
		guild: { id: "guild-id", name: "Test Guild", memberCount: 2 },
		user: {
			username: "Tester",
			displayAvatarURL: () => "https://example.invalid/avatar.png",
		},
		client: {
			channels: {
				fetch: async () => {
					assert.fail("Preview should send to its target channel without fetching the configured channel");
				},
			},
		},
	};
	member.guild.members = {
		me: {},
	};
	const previewChannel = {
		name: "preview",
		permissionsFor: () =>
			new PermissionsBitField([
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.EmbedLinks,
				PermissionsBitField.Flags.AttachFiles,
			]),
		send: async (payload) => {
			if (shouldAbortUpload) throw new DOMException("request timed out", "AbortError");
			sentPayload = payload;
		},
	};

	assert.equal(await sendGreeting(member, "welcome", previewChannel), true);
	assert.equal(sentPayload.embeds[0].data.title, "Hi Tester");
	assert.equal(sentPayload.files[0].name, "welcome.gif");
	shouldAbortUpload = true;
	await assert.rejects(sendGreeting(member, "welcome", previewChannel), (error) => {
		assert.equal(error.message, "Discord timed out while sending the greeting card to #preview.");
		assert.equal(error.cause.name, "AbortError");
		return true;
	});
});

test("welcomer preview retries a Discord socket closed before sending", async (t) => {
	const originalFetch = global.fetch;
	const previousWelcome = useHooks.get("welcome");
	const previousFunctions = useHooks.get("functions");
	const previousConfig = useHooks.get("config");
	t.after(() => {
		global.fetch = originalFetch;
		useHooks.set("welcome", previousWelcome);
		useHooks.set("functions", previousFunctions);
		useHooks.set("config", previousConfig);
	});

	global.fetch = async () => new Response(Buffer.from("GIF89a\u0001\u0000\u0001\u0000"), { status: 200 });
	useHooks.set("welcome", new Map([["guild-id", [{ content: JSON.stringify({ title: "Hi {userName}" }) }]]]));
	useHooks.set("functions", {
		get: () => ({
			execute: (value) => value?.replace("{userName}", "Tester"),
		}),
	});
	useHooks.set("config", { defaultColor: 0x123456 });

	let sendAttempts = 0;
	const member = {
		guild: {
			id: "guild-id",
			name: "Test Guild",
			memberCount: 2,
			members: { me: {} },
		},
		user: {
			username: "Tester",
			displayAvatarURL: () => "https://example.invalid/avatar.png",
		},
	};
	const previewChannel = {
		name: "preview",
		permissionsFor: () =>
			new PermissionsBitField([
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.EmbedLinks,
				PermissionsBitField.Flags.AttachFiles,
			]),
		send: async () => {
			sendAttempts += 1;
			if (sendAttempts === 1) {
				throw Object.assign(new Error("other side closed"), {
					code: "UND_ERR_SOCKET",
					socket: { bytesWritten: 0 },
				});
			}
			return { id: "sent-message" };
		},
	};

	assert.equal(await sendGreeting(member, "welcome", previewChannel), true);
	assert.equal(sendAttempts, 2);
});

test("welcomer permission check lists missing send-related permissions", async () => {
	const botMember = {};
	const channel = {
		permissionsFor: (member) => {
			assert.equal(member, botMember);
			return new PermissionsBitField(PermissionsBitField.Flags.SendMessages);
		},
	};
	const missing = await getMissingGreetingPermissions(channel, { members: { me: botMember } });

	assert.deepEqual(missing, ["Embed Links", "Attach Files"]);
});

test("welcomer setup does not save when bot lacks permissions in a configured channel", async () => {
	const channel = {
		id: "welcome-channel",
		permissionsFor: () => new PermissionsBitField(),
	};
	const guild = {
		id: "guild-id",
		members: { me: {} },
		channels: { fetch: async () => channel },
	};
	let response;
	let saved = false;

	await welcomer.setupWelcome({
		interaction: {
			guild,
			deferReply: async () => {},
			editReply: async (payload) => {
				response = payload;
			},
		},
		options: {
			db: {
				ZiWelcome: {
					findOne: async () => null,
					updateOne: async () => {
						saved = true;
					},
				},
			},
			Welcome: { set: () => assert.fail("Should not cache an invalid configuration") },
			channel,
			content: null,
			byechannel: null,
			byecontent: null,
			animation: null,
			byeanimation: null,
			title: null,
			footer: null,
			image: null,
			thumbnail: null,
			byetitle: null,
			byefooter: null,
			byeimage: null,
			byethumbnail: null,
		},
	});

	assert.equal(saved, false);
	assert.match(response.content, /thiếu quyền/);
	assert.match(response.content, /Send Messages, Embed Links, Attach Files/);
	assert.match(response.content, /<\#welcome-channel>/);
});
