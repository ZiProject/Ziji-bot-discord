/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { JSX, Builder, loadImage, Font, FontFactory } = require("canvacord");

class GreetingsCard extends Builder {
	constructor() {
		super(930, 280);
		this.bootstrap({
			displayName: "",
			type: "welcome",
			avatar: "",
			message: "",
			BGimage: "",
		});
		if (!FontFactory.size) Font.loadDefault();
	}

	setDisplayName(value) {
		this.options.set("displayName", value);
		return this;
	}

	setType(value) {
		this.options.set("type", value);
		return this;
	}

	setAvatar(value) {
		this.options.set("avatar", value);
		return this;
	}

	setMessage(value) {
		this.options.set("message", value);
		return this;
	}

	async render() {
		const { type, displayName, avatar, message, BGimage } = this.options.getOptions();

		const image = await loadImage(avatar);

		return JSX.createElement(
			"div",
			{
				className: "h-full w-full flex flex-col items-center justify-center rounded-xl",
				style: {
					display: "flex",
					borderRadius: "1rem",
					background: "linear-gradient(to bottom right, #120C17, #010424, #53049c)",
				},
			},
			JSX.createElement(
				"div",
				{
					className: "px-6 bg-[#2B2F35AA] w-[96%] h-[84%] rounded-lg flex items-center",
				},
				JSX.createElement("img", {
					src: image.toDataURL(),
					className: "flex h-[40] w-[40] rounded-full",
				}),
				JSX.createElement(
					"div",
					{ className: "flex flex-col ml-6" },
					JSX.createElement(
						"h1",
						{ className: "text-5xl text-white font-bold m-0" },
						type === "welcome" ? "Welcome" : "Goodbye",
						",",
						" ",
						JSX.createElement("span", { className: "text-blue-500" }, displayName, "!"),
					),
					JSX.createElement("p", { className: "text-gray-300 text-3xl m-0" }, message),
				),
			),
		);
	}
}

module.exports = { GreetingsCard };
