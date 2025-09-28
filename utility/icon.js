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

module.exports = {
	refesh: "<:refesh:1261486580015829062>",
	prev: "<:prev:1261482963594383502>",
	pause: "<:pause:1261482959006072862>",
	play: "<:play:1261482961199698051>",
	next: "<:next:1261482957135417455>",
	stop: "<:stop:1261482972545159189>",
	search: "<:search:1261482967323381781>",
	section: "<:section:1254203682686373938>",
	loop: "<:loop:1261482945139572841>",
	loop1: "<:loop1:1261482947324678195>",
	loopA: "<:loopA:1261482948792946780>",
	loopQ: "<:loopQ:1261482951116591185>",
	queue: "<:queue:1261482965272100906>",
	mute: "<:mute:1261482954950185022>",
	volinc: "<:volinc:1261483382731440190>",
	voldec: "<:voldec:1261482974327869460>",
	lyrics: "<:lyrics:1261482953297629246>",
	shuffle: "<:shuffle:1261483380890013738>",
	UnLock: "<:unlock:1266343614204739645>",
	Lock: "<:lock:1266343196657713193>",
	yess: "<a:yess:1254117363532562515>",
	noo: "<a:noo:1254117362085658634>",
	Playbutton: "<:Playbutton:1230129096160182322>",
	fillter: "<:fillter:1268578610051289109>",
	save: "<:save:1318431237794172969>",
	left: "<:left:1356598826563272724>",
	right: "<:play:1261482961199698051>",
	up: "<:up:1356598839129407589>",
	down: "<:down:1356598815804882985>",
	youtubeIconURL: "https://cdn.discordapp.com/attachments/1064851388221358153/1243685364502102066/youtube.gif",
	spotifyIconURL: "https://cdn.discordapp.com/attachments/1064851388221358153/1243684923626356846/spotify.gif",
	soundcloudIconURL: "https://cdn.discordapp.com/attachments/1064851388221358153/1243684572672037027/SOUNDCLOUD.gif",
	AttachmentIconURL: "https://cdn.discordapp.com/attachments/1064851388221358153/1091717240669348010/ezgif.com-crop_1.gif",
	animatedIcons: [
		"1150775508045410385",
		"1150776048263364608",
		"1150777291417333840",
		"1150777857761615903",
		"1150777891102150696",
		"1150777933045178399",
		"1150782781144707142",
		"1150782787394228296",
		"1008064606075363398",
		"1231819570281447576",
		"1231819570281447576",
		"1231819570281447576",
		"1238577097363034156",
		"1238577100101779507",
		"1238577101787889754",
		"1238577103025209517",
		"1238577106066346146",
		"1238577108503236629",
		"1238577113548980264",
		"1238577077368651797",
		"1238577079122137108",
		"1238577080858316810",
		"1238577084389916732",
		"1238577086810034176",
		"1238577089335267368",
		"1238577091406987294",
		"1238577093332176937",
		"1238577095488176309",
	],
};
