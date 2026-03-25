# Ziji Discord Bot — AI Reference Guide

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

## 2. Create Event

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

## 4. Create commands: `commands.js`

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

## 5. Add functions: `functions.js`

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

## 6. Add extensions: `extensions.js`

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

## 9. Music System (Ziplayer)

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
