# Ziji Discord Bot — AI Reference Guide

---

## 0. Project Structure

```
ziji-bot/
├── commands/           # Slash & context menu commands
│   ├── config/         # User/guild settings (language)
│   ├── context/        # Right-click context menus (play, quote, translate)
│   ├── fun/            # Fun commands (ai, anime, avatar, quote, userinfo)
│   ├── games/          # Mini-games (2048, blackjack, slots, snake, zoo…)
│   ├── moderation/     # Mod tools (ban, kick, purge, ticket, welcomer…)
│   ├── music/          # Music commands (play, filter, lyrics, tts, volume…)
│   ├── owner/          # Bot owner only (eval, shutdown, dev-ban…)
│   ├── random/         # Random media (cat, dog)
│   └── utility/        # General utilities (help, profile, translate, weather…)
│
├── events/             # Event listeners (loaded by startup/loader)
│   ├── client/         # Discord client events (ready, interactionCreate…)
│   ├── console/        # readline events (line, close)
│   ├── player/         # Ziplayer events (trackStart, queueEnd, ttsStart…)
│   └── process/        # Node.js process events (uncaughtException…)
│
├── extensions/         # Run once at startup (services, routes, AI init…)
│   └── routes/         # Express/WS routes (lyrics, search, stream…)
│
├── functions/          # Interaction handlers (indexed by customId)
│   ├── ai/             # AI runners (runAI, runVoice)
│   ├── button/         # Button handlers (B_*)
│   ├── modal/          # Modal submit handlers (M_*)
│   ├── other/          # Misc (joinToCreate, Variable)
│   ├── player/         # Music UI logic (Queue, Search, TTS, player_func)
│   ├── ranksys/        # ZiRank — XP + language resolution
│   ├── SelectMenu/     # Select menu handlers (S_*)
│   └── utils/          # Shared embeds (errorEmbed, successEmbed)
│
├── helper/             # Template files for devs (commands/events/functions/extensions)
├── lang/               # Language files (en.js, vi.js, ja.js)
├── startup/            # Boot sequence (loader, deploy, mongoDB, logger…)
├── utility/            # Canvas cards & image generators (rank, welcome, music…)
├── utils/              # Standalone helpers (hoyolab, lootbox, zigoldManager)
└── data/               # Static data (animals.json)
```

---

> This document describes the architecture, file structure, and behavior of Ziji Bot — a Discord bot built with Node.js and
> Discord.js. Last updated to reflect the full project tree.

---

## 1. Architecture Overview

Ziji Bot uses a custom hook system called **`zihooks`** to share global state across all modules via a singleton `Map` named
`useHooks`. This is the central hub connecting every part of the system.

### Global State (`useHooks`)

| Key          | Type             | Description                                          |
| ------------ | ---------------- | ---------------------------------------------------- |
| `config`     | Object           | Bot configuration (OwnerID, cooldown duration, etc.) |
| `client`     | Discord.Client   | Discord client instance                              |
| `welcome`    | Collection       | Welcome messages                                     |
| `cooldowns`  | Collection       | Per-user cooldown tracking                           |
| `responder`  | Collection       | Auto Responder rules                                 |
| `commands`   | Collection       | Slash Commands (indexed by name)                     |
| `Mcommands`  | Collection       | Message Commands                                     |
| `functions`  | Collection       | Functions (components, modals, etc.)                 |
| `extensions` | Collection       | Extensions loaded at startup                         |
| `logger`     | LoggerFactory    | System logger                                        |
| `wss`        | WebSocket Server | WebSocket server instance                            |
| `server`     | Web Server       | HTTP server instance                                 |
| `icon`       | any              | Bot icon (`zzicon`)                                  |
| `db`         | MongoDB          | MongoDB database connection                          |

**Accessing global state from any module:**

```js
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
```

---

## 2. Event Loader Structure

The bot loads events from 4 directories:

| Folder           | Event Source                                        |
| ---------------- | --------------------------------------------------- |
| `events/client`  | Discord Client events (e.g. `ready`, `guildCreate`) |
| `events/process` | Node.js process events (e.g. `uncaughtException`)   |
| `events/console` | readline console input                              |
| `events/player`  | Ziplayer Manager events                             |

---

## 3. File Template: `events.js`

Every event file follows this structure:

```js
const { useHooks } = require("zihooks");

module.exports = {
	name: "Event Name", // event identifier
	type: "events",
	once: true, // (optional) run only once
	enable: true, // enable or disable this event

	execute: async (args) => {
		// event logic here
		useHooks.get("logger").info("Event fired:", args);
	},
};
```

| Field     | Description                                         |
| --------- | --------------------------------------------------- |
| `name`    | Event name (e.g. Discord event name or custom name) |
| `type`    | Always `"events"`                                   |
| `once`    | If `true`, the listener is removed after first fire |
| `enable`  | Set to `false` to skip loading this event           |
| `execute` | Async handler function; receives event arguments    |

---

## 4. File Template: `commands.js`

Slash commands and context menu commands. Stored in `useHooks.get("commands")`, indexed by `name`.

### `module.exports.data` — Metadata

```js
module.exports.data = {
  name: "helper",
  description: "Helper Description",
  type: 1,
  options: [ ... ],
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  default_member_permissions: "0",
  category: "musix",
  lock: true,
  ckeckVoice: true,
  enable: true,
  alias: ["cmd1", "cmd2"],
};
```

| Field                        | Type    | Description                                                                                                                                                                         |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                       | string  | Command name used for `/name`                                                                                                                                                       |
| `description`                | string  | Shown in Discord command picker                                                                                                                                                     |
| `type`                       | number  | `1`=CHAT_INPUT, `2`=USER, `3`=MESSAGE, `4`=PRIMARY_ENTRY_POINT                                                                                                                      |
| `options`                    | array   | Command parameters ([Discord API reference](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)) |
| `integration_types`          | array   | `0`=Guild install, `1`=User install                                                                                                                                                 |
| `contexts`                   | array   | `0`=Guild, `1`=Bot DM, `2`=Private Channel                                                                                                                                          |
| `default_member_permissions` | string  | Permission bit set. `"0"` = admins only                                                                                                                                             |
| `category`                   | string  | `"musix"` → injects `player` into `execute`                                                                                                                                         |
| `lock`                       | boolean | `true` → only the current music host can use                                                                                                                                        |
| `ckeckVoice`                 | boolean | `true` → user must be in the same voice channel as the bot                                                                                                                          |
| `enable`                     | boolean | Enable or disable this command                                                                                                                                                      |
| `alias`                      | array   | Aliases for message command variant                                                                                                                                                 |

### `module.exports.execute` — Slash Command Handler

```js
module.exports.execute = async ({ interaction, lang, player }) => {
	// interaction: Discord.js CommandInteraction
	// lang: language object (e.g. vi.js)
	// player: Ziplayer instance (only present if category === "musix")
	return interaction.reply({ content: "Hello!", ephemeral: true });
};
```

### `module.exports.run` — Message Command Handler

```js
module.exports.run = async ({ message, args, lang }) => {
	// message: Discord.js Message
	// args: string[] of message arguments
	// lang: language object
	return message.reply({ content: "Hello from message command!" });
};
```

---

## 5. File Template: `functions.js`

Functions handle **message components** (buttons, select menus), **modals**, and any interaction identified by a `customId`.
Stored in `useHooks.get("functions")`, indexed by `name` (which must match the `customId`).

### `module.exports.data` — Metadata

```js
module.exports.data = {
	name: "Functions Helper", // must match customId of the component/modal
	type: "any",
	category: "musix", // injects player if set
	lock: true, // only host can trigger
	ckeckVoice: true, // user must be in bot's voice channel
	enable: true,
};
```

### `module.exports.execute`

```js
module.exports.execute = async (args) => {
	// args passed from interactionCreate or manual call
};
```

### Calling a Function Manually

```js
await useHooks.get("functions").get("Functions Helper").execute(args);
```

---

## 6. File Template: `extensions.js`

Extensions run **once at bot startup**. Used to initialize services, register external connections, patch global behavior, etc.

```js
module.exports.data = {
	name: "extensions Helper",
	type: "extension",
	enable: true,
	priority: 1, // 1 = highest priority, 10 = lowest; lower loads first
};

module.exports.execute = async (client) => {
	// client = Discord.Client instance
	console.log("Hello World!");
};
```

| Field      | Description                                        |
| ---------- | -------------------------------------------------- |
| `priority` | Load order: `1` loads before `10`                  |
| `enable`   | Set to `false` to skip this extension              |
| `execute`  | Receives the Discord `client` as the only argument |

---

## 7. Core Event: `interactionCreate` — Main Execution Flow

This event handles all Discord interactions. Full flow:

```
Interaction received
  │
  ├─ isChatInputCommand / isAutocomplete / isMessageContextMenuCommand
  │     → look up in commands Collection by commandName
  │
  └─ isMessageComponent / isModalSubmit
        → look up in functions Collection by customId
         │
         ▼
   Not found? → logger.debug, return early
         │
         ▼
   Call ZiRank function
     → returns lang object for user's language
     → adds XP to user (XpADD: 0 if autocomplete)
         │
         ▼
   isAutocomplete?
     → call command.autocomplete({ interaction, lang }), return
         │
         ▼
   checkStatus()
     1. Does bot have SendMessages + ViewChannel permission in channel?
     2. Is the user banned? (checked in jsons/developer.json)
     3. Is the user an OwnerID? → skip all further checks
     4. isModalSubmit? → skip cooldown
     5. Is the user on cooldown? (default: 3000ms)
        → reply with remaining time if so
         │
         ▼
   command.data.category === "musix"?
     → checkMusicstat():
         - Must be in a guild
         - lock=true → user must be the current music host (requestedBy)
         - ckeckVoice=true → user must be in same voice channel as bot
         │
         ▼
   command.execute({ interaction, lang, ...cmdops })
```

---

## 8. Language System (`lang`)

- Retrieved via the `ZiRank` function inside the `functions` collection.
- Returns a language object based on the user's saved language preference.
- Default language file: `lang/vi.js`.
- Also awards XP to the user on each interaction (set `XpADD: 0` to skip).

### Common `lang` Keys

| Key                       | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `lang.until.NOPermission` | Bot lacks permission in the channel                            |
| `lang.until.banned`       | User is banned from using the bot                              |
| `lang.until.cooldown`     | Cooldown message (supports `{command}`, `{time}` placeholders) |
| `lang.until.noGuild`      | Command can only be used in a guild                            |
| `lang.until.noPermission` | User lacks permission due to lock                              |
| `lang.music.NoPlaying`    | No music is currently playing                                  |
| `lang.music.NOvoiceMe`    | User is not in the bot's voice channel                         |

---

## 9. Music System (Musix / Ziplayer)

Uses the **`ziplayer`** library. Retrieve a guild's player instance:

```js
const { getPlayer } = require("ziplayer");
const player = getPlayer(interaction.guild.id);
```

### Key Player Properties

| Property                      | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `player.connection`           | Current voice connection (`null` if not playing) |
| `player.userdata.LockStatus`  | Whether the player is currently locked to a user |
| `player.userdata.requestedBy` | The user who currently holds music control       |

### When `category: "musix"` is set on a command/function:

- `checkMusicstat()` runs automatically before `execute`.
- If checks pass, `player` is injected into `execute` args.
- If checks fail, the interaction is replied to with an error and execution stops.

---

## 10. Error Handling

```js
try {
	await command.execute({ interaction, lang, ...cmdops });
} catch (error) {
	client.errorLog(`**${error.message}**`);
	client.errorLog(error.stack);

	const response = { content: "There was an error while executing this command!", ephemeral: true };

	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(response).catch(() => {});
	} else {
		await interaction.reply(response).catch(() => {});
	}
}
```

- All errors are logged via `client.errorLog()`.
- The user always receives an ephemeral error message.
- Uses `followUp` if the interaction was already replied/deferred, otherwise `reply`.

---

## 11. Conventions & Key Notes

| Rule                            | Detail                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| `useHooks` is a singleton       | Import from `"zihooks"` anywhere to access shared state     |
| Commands indexed by `name`      | `useHooks.get("commands").get("commandName")`               |
| Functions indexed by `customId` | `useHooks.get("functions").get("customId")`                 |
| `OwnerID` bypasses checks       | Owners skip cooldown, ban check, and permission checks      |
| Default cooldown                | `config.defaultCooldownDuration` (default: `3000ms`)        |
| `enable: false`                 | Prevents the module from being loaded entirely              |
| `priority` (extensions only)    | Lower number = loaded earlier (range: 1–10)                 |
| `category: "musix"`             | Triggers music pre-checks and injects `player` into execute |
| `lock: true`                    | Restricts command to the current music host only            |
| `ckeckVoice: true`              | User must share the bot's active voice channel              |
