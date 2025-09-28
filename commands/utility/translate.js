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

const { EmbedBuilder } = require("discord.js");
const translate = require("@iamtraction/google-translate");
module.exports.data = {
	name: "translate",
	description: "Translate any language",
	type: 1, // slash command
	options: [
		{
			name: "text",
			description: "Text to translate",
			type: 3, // string
			required: true,
			autocomplete: true,
		},
		{
			name: "lang",
			description: "Language to translate to",
			type: 3, // string
			required: false,
			choices: [
				{ name: "Tiếng Việt", value: "vi" },
				{ name: "English", value: "en" },
				{ name: "Chinese Simplified", value: "zh-cn" },
				{ name: "Japanese", value: "ja" },
				{ name: "Korean", value: "ko" },
				{ name: "Español", value: "es" },
				{ name: "Français", value: "fr" },
				{ name: "Deutsch", value: "de" },
				{ name: "Italiano", value: "it" },
				{ name: "Thai", value: "th" },
			],
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	const { options, user } = interaction;
	const text = options.getString("text", true);
	const langTo = options.getString("lang", false) || lang?.name || "en";
	const translated = await translate(text, { from: "auto", to: langTo });
	const embed = new EmbedBuilder()
		.setTitle(`Translated ${this.language[translated.from.language.iso]} -> ${this.language[langTo]}:`)
		.setDescription(translated.text)
		.setColor(lang?.color || "Random")
		.setFooter({
			text: `${lang.until.requestBy} ${user?.username}`,
			iconURL: user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
};

/**
 * @param { object } autocomplete - object autocomplete
 * @param { AutocompleteInteraction } autocomplete.interaction - interaction
 * @param { import('../../lang/vi.js') } autocomplete.lang - language
 */

module.exports.autocomplete = async ({ interaction, lang }) => {
	try {
		const text = interaction.options.getString("text", true);
		const langTo = lang?.name || "en";
		const translated = await translate(text, { to: langTo });
		const transtext = translated.from?.text?.value;
		if (!transtext) return;
		await interaction.respond([
			{
				name: transtext,
				value: transtext.replace(/[\[\]]/g, ""),
			},
		]);
		return;
	} catch (e) {
		console.error(e);
	}
};

module.exports.language = {
	auto: "Automatic",
	af: "Afrikaans",
	sq: "Albanian",
	am: "Amharic",
	ar: "Arabic",
	hy: "Armenian",
	az: "Azerbaijani",
	eu: "Basque",
	be: "Belarusian",
	bn: "Bengali",
	bs: "Bosnian",
	bg: "Bulgarian",
	ca: "Catalan",
	ceb: "Cebuano",
	ny: "Chichewa",
	"zh-cn": "Chinese Simplified",
	"zh-tw": "Chinese Traditional",
	co: "Corsican",
	hr: "Croatian",
	cs: "Czech",
	da: "Danish",
	nl: "Dutch",
	en: "English",
	eo: "Esperanto",
	et: "Estonian",
	tl: "Filipino",
	fi: "Finnish",
	fr: "French",
	fy: "Frisian",
	gl: "Galician",
	ka: "Georgian",
	de: "German",
	el: "Greek",
	gu: "Gujarati",
	ht: "Haitian Creole",
	ha: "Hausa",
	haw: "Hawaiian",
	iw: "Hebrew",
	hi: "Hindi",
	hmn: "Hmong",
	hu: "Hungarian",
	is: "Icelandic",
	ig: "Igbo",
	id: "Indonesian",
	ga: "Irish",
	it: "Italian",
	ja: "Japanese",
	jw: "Javanese",
	kn: "Kannada",
	kk: "Kazakh",
	km: "Khmer",
	ko: "Korean",
	ku: "Kurdish (Kurmanji)",
	ky: "Kyrgyz",
	lo: "Lao",
	la: "Latin",
	lv: "Latvian",
	lt: "Lithuanian",
	lb: "Luxembourgish",
	mk: "Macedonian",
	mg: "Malagasy",
	ms: "Malay",
	ml: "Malayalam",
	mt: "Maltese",
	mi: "Maori",
	mr: "Marathi",
	mn: "Mongolian",
	my: "Myanmar (Burmese)",
	ne: "Nepali",
	no: "Norwegian",
	ps: "Pashto",
	fa: "Persian",
	pl: "Polish",
	pt: "Portuguese",
	pa: "Punjabi",
	ro: "Romanian",
	ru: "Russian",
	sm: "Samoan",
	gd: "Scots Gaelic",
	sr: "Serbian",
	st: "Sesotho",
	sn: "Shona",
	sd: "Sindhi",
	si: "Sinhala",
	sk: "Slovak",
	sl: "Slovenian",
	so: "Somali",
	es: "Spanish",
	su: "Sundanese",
	sw: "Swahili",
	sv: "Swedish",
	tg: "Tajik",
	ta: "Tamil",
	te: "Telugu",
	th: "Thai",
	tr: "Turkish",
	uk: "Ukrainian",
	ur: "Urdu",
	uz: "Uzbek",
	vi: "Vietnamese",
	cy: "Welsh",
	xh: "Xhosa",
	yi: "Yiddish",
	yo: "Yoruba",
	zu: "Zulu",
};
