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

class MusicSearchCard extends Builder {
	constructor() {
		super(2000, 420);
		this.bootstrap({
			title: "",
			players: [],
		});
		if (!FontFactory.size) Font.fromFileSync("./utility/SVN-Avo.ttf");
		this.memoizedRenderDefaultPlayer = this.memoize(this.renderDefaultPlayer);
		this.calculateDimensions = this.memoize(calculateDimensions);
	}

	memoize(fn) {
		const cache = new Map();
		return function (...args) {
			const key = JSON.stringify(args);
			if (cache.has(key)) return cache.get(key);
			const result = fn.apply(this, args);
			cache.set(key, result);
			return result;
		};
	}

	setTitle(title) {
		this.options.set("title", title);
		return this;
	}

	setPlayers(players) {
		const items = players.slice(0, 20);
		this.options.set("players", items);
		return this;
	}

	async renderDefaultPlayer({ index, image, displayName, time }) {
		return JSX.createElement(
			"div",
			{
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					backgroundColor: "rgba(255, 255, 255, 0.1)",
					borderRadius: "0.75rem",
					padding: "0.75rem",
					transition: "background-color 0.3s ease",
				},
			},
			JSX.createElement(
				"div",
				{ style: { display: "flex", alignItems: "center" } },
				JSX.createElement(
					"div",
					{
						style: {
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							marginRight: "1rem",
							fontSize: "1.5rem",
							fontWeight: "bold",
							width: "30px",
							height: "30px",
							backgroundColor: "rgba(255, 255, 255, 0.2)",
							borderRadius: "9999px",
						},
					},
					index,
				),
				JSX.createElement("img", {
					src: image.toDataURL(),
					width: 55,
					height: 55,
					style: { borderRadius: "9999px", marginRight: "1rem" },
					alt: "avatar",
					display: "flex",
				}),
				JSX.createElement(
					"div",
					{ style: { display: "flex", flexDirection: "column", justifyContent: "center" } },
					JSX.createElement(
						"div",
						{
							style: {
								display: "flex",
								fontSize: "1.25rem",
								fontWeight: "600",
								marginBottom: "0.25rem",
							},
						},
						displayName.length > 30 ? displayName.slice(0, 30) + "..." : displayName,
					),
					JSX.createElement(
						"div",
						{
							style: {
								display: "flex",
								fontSize: "1.125rem",
								fontWeight: "500",
								color: "rgb(209, 213, 219)",
							},
						},
						time,
					),
				),
			),
		);
	}

	async render() {
		const { title, players } = this.options.getOptions();
		const maxPlayersPerColumn = Math.ceil(players.length / 2);
		const { height, width } = this.calculateDimensions(players.length);
		this.height = height;
		this.width = width;
		this.adjustCanvas();
		const leftColumn = players.slice(0, maxPlayersPerColumn);
		const rightColumn = players.slice(maxPlayersPerColumn);

		const imagePromises = players.map((player) => getCachedImage(player.avatar));
		const images = await Promise.all(imagePromises);
		const imageMap = new Map(players.map((player, index) => [player.avatar, images[index]]));

		const renderPlayerWithImage = (player) => {
			const image = imageMap.get(player.avatar);
			return this.memoizedRenderDefaultPlayer({ ...player, image });
		};

		const processedPlayerGroups = await Promise.all([
			Promise.all(leftColumn.map(renderPlayerWithImage)),
			Promise.all(rightColumn.map(renderPlayerWithImage)),
		]);
		return JSX.createElement(
			"div",
			{
				style: {
					display: "flex",
					flexDirection: "column",
					background: "linear-gradient(to bottom right, #120C17, #010424, #53049c)",
					borderRadius: "1rem",
					height: `${this.height}px`,
					width: `${this.width}px`,
					padding: "15px",
				},
			},
			JSX.createElement(
				"div",
				{
					style: { display: "flex", justifyContent: "center", width: "100%", marginBottom: "1rem" },
				},
				title &&
					JSX.createElement(
						"div",
						{
							style: {
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
							},
						},
						JSX.createElement(
							"div",
							{
								style: { display: "flex", color: "white", fontWeight: "bold", fontSize: "1.5rem" },
							},
							title,
						),
						JSX.createElement("div", {
							style: {
								display: "flex",
								width: "4rem",
								height: "0.2rem",
								backgroundColor: "rgba(255, 255, 255, 0.5)",
								marginTop: "0.3rem",
								borderRadius: "9999px",
							},
						}),
					),
			),
			JSX.createElement(
				"div",
				{ style: { display: "flex", color: "white", gap: "15px" } },
				processedPlayerGroups.map((renderedPlayers) =>
					JSX.createElement(
						"div",
						{ style: { display: "flex", flexDirection: "column", flex: 1, gap: "8px" } },
						...renderedPlayers,
					),
				),
			),
		);
	}
}

const imageCache = new Map();
const MAX_CACHE_SIZE = 100;

async function getCachedImage(url) {
	if (imageCache.has(url)) {
		return imageCache.get(url);
	}
	if (imageCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = imageCache.keys().next().value;
		imageCache.delete(oldestKey);
	}
	try {
		const image = await loadImage(url);
		imageCache.set(url, image);
		return image;
	} catch {
		const fallbackImage = await loadImage("https://raw.githubusercontent.com/zijipia/zijipia/main/Assets/image.png");
		imageCache.set(url, fallbackImage);
		return fallbackImage;
	}
}

const calculateDimensions = (playersCount) => {
	const playerHeight = 80;
	const titleHeight = 60;
	const padding = 30;
	const maxPlayersPerColumn = Math.ceil(playersCount / 2);

	const height = titleHeight + padding + playerHeight * maxPlayersPerColumn + (maxPlayersPerColumn - 1) * 10 + 20;
	const width = 550 * 2 + padding;

	return { height, width };
};

module.exports = { MusicSearchCard };
