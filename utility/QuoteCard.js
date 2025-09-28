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

class QuoteCard extends Builder {
	constructor() {
		super(1200, 630);
		this.bootstrap({
			text: "",
			author: "",
			tag: "",
			bgcolor: true,
			watermark: "",
			backgroundImage: "",
		});

		if (!FontFactory.size) Font.loadDefault();
	}

	setText(value) {
		this.options.set("text", value);
		return this;
	}

	setAuthor(value) {
		this.options.set("author", value);
		return this;
	}

	setTag(value) {
		this.options.set("tag", value);
		return this;
	}

	setColor(value) {
		this.options.set("bgcolor", value);
		return this;
	}

	setWatermark(value) {
		this.options.set("watermark", value);
		return this;
	}

	setBackgroundImage(value) {
		this.options.set("backgroundImage", value);
		return this;
	}

	async render() {
		const { text, author, tag, watermark, bgcolor, backgroundImage } = this.options.getOptions();
		const img = await loadImage(backgroundImage);

		return JSX.createElement(
			"div",
			{
				className: "w-full h-full flex relative",
				style: {
					backgroundColor: "#000000",
					borderRadius: "0.5rem",
					overflow: "hidden",
				},
			},
			JSX.createElement(
				"div",
				{
					className: "w-1/2 flex relative",
					style: {
						width: "50%",
						height: "100%",
					},
				},
				JSX.createElement("img", {
					src: img.toDataURL(),
					className: "h-full w-full",
					style: {
						objectFit: "cover",
						objectPosition: "center",
						width: "100%",
						height: "100%",
						filter: bgcolor ? "none" : "grayscale(100%) brightness(0.9) contrast(1.2)",
					},
				}),
				JSX.createElement("div", {
					className: "absolute inset-0 flex",
					style: {
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background:
							"linear-gradient(60deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.8) 65%, rgba(0,0,0,0.95) 85%, #000000 100%)",
					},
				}),
				JSX.createElement("div", {
					className: "absolute inset-0 flex",
					style: {
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.9) 100%)",
					},
				}),
			),

			JSX.createElement(
				"div",
				{
					className: "w-1/2 relative flex flex-col justify-center items-center text-center",
					style: {
						display: "flex",
						position: "relative",
						width: "50%",
						height: "100%",
						flexDirection: "column",
						justifyContent: "center",
						alignItems: "center",
						textAlign: "center",
						padding: "2rem",
					},
				},
				JSX.createElement(
					"div",
					{
						style: {
							display: "flex",
							position: "relative",
							width: "100%",
							height: "100%",
							flexDirection: "column",
							justifyContent: "center",
							alignItems: "center",
						},
					},
					JSX.createElement(
						"h2",
						{
							className: "text-white flex font-bold",
							style: {
								fontSize: "3rem",
								fontWeight: "bold",
								color: "#ffffff",
								marginBottom: "1rem",
								lineHeight: "1.2",
							},
						},
						text,
					),
					author &&
						JSX.createElement(
							"p",
							{
								className: "text-white flex",
								style: {
									fontSize: "1.5rem",
									color: "#ffffff",
									marginBottom: "0.5rem",
								},
							},
							`- ${author}`,
						),
					tag &&
						JSX.createElement(
							"p",
							{
								className: "text-gray-400 flex",
								style: {
									fontSize: "1rem",
									color: "#9ca3af",
									marginBottom: "2rem",
								},
							},
							tag,
						),
					watermark &&
						JSX.createElement(
							"div",
							{
								style: {
									position: "absolute",
									display: "flex",

									bottom: "1rem",
									right: "1rem",
								},
							},
							JSX.createElement(
								"p",
								{
									className: "text-gray-500 flex",
									style: {
										fontSize: "0.875rem",
										color: "#6b7280",
									},
								},
								watermark,
							),
						),
				),
			),
		);
	}
}

module.exports = { QuoteCard };
