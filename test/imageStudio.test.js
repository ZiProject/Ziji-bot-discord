const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
	createImageStudioAttachment,
	createGreetingAnimationPayload,
	prepareImageStudioAnimation,
	readImageStudioAnimation,
} = require("../utility/imageStudio");
const quoteCommand = require("../commands/fun/quote");
const profileCommand = require("../commands/utility/profile");

test("Image Studio attachments accept PNG and GIF responses", async (t) => {
	const originalFetch = global.fetch;
	t.after(() => {
		global.fetch = originalFetch;
	});

	let responseBody;
	let request;
	global.fetch = async (url, options) => {
		request = { url, options };
		return new Response(responseBody, { status: 200 });
	};

	responseBody = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
	const pngAttachment = await createImageStudioAttachment({ type: "profile", data: {} }, "profile.png");
	assert.equal(pngAttachment.name, "profile.png");
	assert.equal(request.url, "https://image-studio-green.vercel.app/api/generate");
	assert.equal(request.options.method, "POST");
	assert.deepEqual(JSON.parse(request.options.body), { type: "profile", data: {} });

	responseBody = Buffer.from("GIF89a\u0001\u0000\u0001\u0000");
	const gifAttachment = await createImageStudioAttachment({ type: "animated", data: {} }, "welcome.gif");
	assert.equal(gifAttachment.name, "welcome.gif");
	assert.ok(gifAttachment.attachment.subarray(0, 6).equals(Buffer.from("GIF89a")));

	responseBody = Buffer.from("not an image");
	await assert.rejects(createImageStudioAttachment({}, "invalid.png"), /invalid PNG or GIF/);
});

test("quote command exposes API layouts and sends the selected layout", async (t) => {
	const originalFetch = global.fetch;
	t.after(() => {
		global.fetch = originalFetch;
	});

	const layouts = quoteCommand.data.options.find((option) => option.name === "layout").choices.map((choice) => choice.value);
	assert.deepEqual(layouts, ["split-portrait", "centered-minimal", "modern-card", "neon-cyber"]);

	let request;
	global.fetch = async (url, options) => {
		request = { url, options };
		return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), {
			status: 200,
		});
	};
	const user = {
		displayName: "Test User",
		username: "test-user",
		tag: "test-user#0001",
		displayAvatarURL: () => "https://example.invalid/avatar.png",
	};
	const interaction = {
		deferReply: async () => {},
		options: {
			getString: (name) => ({ text: "A test quote", layout: "neon-cyber" })[name],
			getUser: () => null,
		},
		user,
		editReply: async () => {},
	};

	await quoteCommand.execute({ interaction, lang: {} });

	assert.deepEqual(JSON.parse(request.options.body).data, {
		quote: "A test quote",
		layout: "neon-cyber",
		author: "Test User",
		handle: "@test-user",
		tag: "test-user#0001",
		avatar: "https://example.invalid/avatar.png",
	});
});

test("profile command exposes all Image Studio rank card themes", () => {
	const themes = profileCommand.data.options.find((option) => option.name === "theme").choices.map((choice) => choice.value);
	assert.deepEqual(themes, ["ruby-poly", "cyber-neon", "glass-minimal", "gold-legend"]);
});

test("Image Studio animation variables are substituted and editor metadata is omitted", () => {
	const animation = {
		...createGreetingAnimationPayload("welcome"),
		templateVariables: {
			userAVTurl: "https://example.invalid/old.png",
			userName: "Old Name",
			guildName: "Old Guild",
		},
	};

	const payload = prepareImageStudioAnimation(animation, {
		userAVTurl: "https://example.invalid/new.png",
		userName: "New Name",
		guildName: "New Guild",
	});

	assert.equal(payload.type, "animated");
	assert.equal(payload.data.format, "gif");
	assert.equal(payload.data.frames[0].elements[0].imageUrl, "https://example.invalid/new.png");
	assert.equal(payload.data.frames[0].elements[1].content, "Welcome, New Name!");
	assert.equal(payload.data.frames[0].elements[2].content, "Joined New Guild");
	assert.equal(Object.hasOwn(payload, "templateVariables"), false);
});

test("Image Studio animation uploads are downloaded and validated", async (t) => {
	const originalFetch = global.fetch;
	t.after(() => {
		global.fetch = originalFetch;
	});

	const payload = createGreetingAnimationPayload("goodbye");
	global.fetch = async (url) => {
		assert.equal(url, "https://cdn.example.invalid/goodbye.json");
		return new Response(JSON.stringify(payload), { status: 200 });
	};

	assert.deepEqual(await readImageStudioAnimation({ url: "https://cdn.example.invalid/goodbye.json" }), payload);

	global.fetch = async () => new Response(JSON.stringify({ type: "profile" }), { status: 200 });
	await assert.rejects(readImageStudioAnimation({ url: "https://cdn.example.invalid/invalid.json" }), /Animation payload must/);
});
