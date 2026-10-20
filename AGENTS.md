# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

**Ziji Bot (Zibot V10)** — a feature-rich Discord bot built with **discord.js** and the **ziplayer** music framework. It is
actively developed; the codebase mixes English and Vietnamese (the bot targets Vietnamese users; strings often use `lang.<key>`
lookups and fall back to `" "`).

## Commands

```bash
npm run dev         # development (nodemon, NODE_ENV=development) — enables loader hot-reload
npm run start       # production (NODE_ENV=production)
npm test            # run all tests (node --test, ./test/*.test.js)
npm run check       # prettier check
npm run format      # prettier write
npm run deploy      # deploy commands to Discord
npm run prisma:generate  # regenerate Prisma clients (mongo + sqlite)
npm run prisma:push:mongo   # push schema to MongoDB
npm run prisma:push:sqlite  # push schema to SQLite
```

Setup: copy `.env.example` → `.env` (fill `TOKEN`, optionally `MONGO`, `GEMINI_API_KEY`) and `config.js.example` → `config.js`.
`MONGO` URI must include a database name (e.g. `/ziji`); `appName` is used as a fallback. `node_modules` is committed-tracked via
`allowScripts`.

## Architecture

### Boot sequence (`index.js` → `startup/index.js`)

`index.js` creates the `discord.js` **Client** and a **PlayerManager** (ziplayer), then a `StartupManager` which:

1. Loads config (`config.js` or `startup/defaultconfig.js`), sets up a winston logger, a Hono web server on the Node adapter (port
   `SERVER_PORT` or 2003) with WebSocket on `/ws`, and optional multi-player login via `MULTI_PLAYER_TOKEN`.
2. `initHooks()` seeds the global state store (**zihooks `useHooks`**) with central `Collection`s: `commands`, `Mcommands`,
   `functions`, `extensions`, `welcome`, `cooldowns`, `responder`, `temp`, `guildCommands`, plus `client`, `config`, `logger`,
   `db`, `wss`, `server`, `icon`, `loaders`.
3. `loadEvents(dir, target)` / `loadModules(dir, collection)` load every `.js` file recursively via `@ziji/loader`, with
   hot-reload (`watch: true`) in development. Module shapes are validated by a `check()` predicate; `disabledCommands` and
   `data.enable === false` skip registration.

### Module loading — the core pattern

The bot is file-driven. New functionality is added by dropping a file into the right directory; the loader picks it up. Do not
register modules manually.

- **Slash / context / message commands** live in `commands/<category>/<name>.js`.
- **Events** live in `events/<domain>/<name>.js`.
- **Functions (UI interactions)** live in `functions/<kind>/<customId>.js`; kinds include `button`, `modal`, `SelectMenu`,
  `utils`, `player`, `other`, `ranksys`, and `ai`.
- **Extensions (startup modules)** live in `extensions/<name>.js`.
- **Guild commands**: custom per-guild slash commands managed through a builder UI (`functions/guildCommand/` +
  `utils/guildCommand*.js`), stored in the DB and registered at runtime into `guildCommands` keyed `guildId:name` (lowercased).

### Authoring commands

Commands export a `data` object and an `execute` handler. The `type` in command metadata is the Discord application command type:
`1` for chat input, `2` for user context menu, `3` for message context menu, or `4` for a primary entry point. `options` follow
the
[Discord application command option structure](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure).
`integration_types` uses `0` for guild install and `1` for user install; `contexts` uses `0` for guild, `1` for bot DM, and `2`
for private channel.

```js
module.exports.data = {
	name: "command-name",
	description: "Command description",
	type: 1,
	options: [],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
	default_member_permissions: "0",
	category: "musix",
	lock: true,
	ckeckVoice: true,
	enable: true,
	alias: ["command-alias"],
};

module.exports.execute = async ({ interaction, lang, player }) => {
	return interaction.editReply({ content: "Done." });
};
```

`default_member_permissions: "0"` makes a command admin-only. `category: "musix"` enables the music checks and injects `player`;
`lock` restricts control to the current music host, and `ckeckVoice` checks that the user is in the bot's voice channel.
`enable: false` disables loading. `alias` applies to the message-command variant. A command may export
`run({ message, args, lang })` for the legacy `z!` message-command path. Chat and context interactions are pre-deferred, so use
`interaction.editReply(...)` in command handlers.

### Authoring events

An event exports `name`, `type: "events"`, and `execute`; `once` and `enable` are optional. The event folder selects its emitter:
`events/client` for Discord client events, `events/process` for Node process events, `events/console` for readline input, and
`events/player` for Ziplayer Manager events.

```js
const { useHooks } = require("zihooks");

module.exports = {
	name: "eventName",
	type: "events",
	once: false,
	enable: true,
	execute: async (...args) => {
		useHooks.get("logger").info("Event fired:", ...args);
	},
};
```

Set `once: true` to remove the listener after its first invocation. Event errors are caught and logged centrally.

### Authoring functions

Functions handle buttons, select menus, modals, and other custom-ID interactions. The module name must exactly match the
interaction's `customId`; `category: "musix"` can be used when the handler needs the checked music `player`.

```js
module.exports.data = {
	name: "component-custom-id",
	type: "any",
	category: "musix",
	lock: true,
	ckeckVoice: true,
	enable: true,
};

module.exports.execute = async ({ interaction, lang, player }) => {
	// Handle the interaction.
};
```

Functions are indexed by name and can also be called from another module with
`useHooks.get("functions").get("component-custom-id").execute(args)`.

### Authoring extensions

Extensions run during startup in priority order; lower numbers load earlier (`1` first, `10` last). They are used for startup work
such as database initialization, command deployment, external connections, AI initialization, and periodic jobs.

```js
module.exports.data = {
	name: "extension-name",
	type: "extension",
	enable: true,
	priority: 1,
};

module.exports.execute = async (client) => {
	// Initialize the extension.
};
```

### Interaction→handler routing (`events/client/interactionCreate.js`)

The central dispatcher. Given an interaction, it resolves a module: chat/message/context commands from `Commands` (falling back to
`guildCommands`), components/modals from `Functions` by `customId`. Chat and context commands are auto-`deferReply`ed via a
`bindMessenger` wrapper that re-binds `interaction.reply`/`editReply` to the messenger's `edit` — so command code can use
`editReply`/`reply` freely and the wrapper keeps flags correct. This is followed by permission/ban/cooldown checks
(`checkStatus`), optional music-player checks (`checkMusicstat` for `category == "musix"`), XP/lang resolution, then
`command.execute(...)`. `messageCommands.js` mirrors this for the prefix-based message path.

### Music player reference

For music-related interactions, `category: "musix"` runs `checkMusicstat()` before the handler and injects `player` when checks
pass. The player exposes `connection` (`null` when not connected) and `userdata` fields including `LockStatus` and `requestedBy`
(the current music controller). If checks fail, the interaction receives an error and the handler does not run.

### Persistence (`startup/prismaDB.js`)

Abstraction over **Prisma** with a fallback chain: **MongoDB → SQLite → in-memory LocalDB** (`@zibot/db`). Exposed as `db` on
hooks. Models are defined in both `prisma/mongo/schema.prisma` and SQL DDL in `prismaDB.js` (kept in sync manually — **update both
when changing a model**). The exposed model classes (`db.ZiUser`, `db.ZiGuild`, …) provide a Mongoose-like API (`find`, `findOne`,
`create`, `updateOne`, `findOneAndUpdate`, `findByIdAndUpdate`, `deleteOne`, `deleteMany`, `findByIdAndDelete`) supporting
Mongo-ish operators (`$set`, `$inc`, `$push`, `$addToSet`, `$unset`, `$gte`, `$regex`, …). JSON fields are stored stringified in
SQLite and hydrated automatically. Sensitive fields are redacted in `prisma_DEBUG` logs.

### Localization (`lang/`)

Per-language JS modules (`vi.js`, `en.js`, `ja.js`). User language is stored per-user in the DB; the `ZiRank` function resolves
the `lang` object passed to every command. Access labels via `lang.<Group>.<Key>` with `|| " "` fallbacks — most labels are
Vietnamese with English/Japanese equivalents.

### Config (`config.js` / `startup/defaultconfig.js`)

Central runtime config accessible via `useHooks.get("config")`: `prefix`, `OwnerID`, `botConfig` (status, activity, banners,
error-log channel), `webAppConfig` (dashboard/music-controller URLs), `disabledCommands`, `defaultCooldownDuration`, `DevConfig`
flags (e.g. `prisma_DEBUG`, `loaderDebug`).

### Web / dashboard

The bot runs a Hono server through `@hono/node-server` (port 2003) plus WebSocket at `/ws` on the same Node HTTP server, used by
the external web dashboard and music controller. Routes live in `extensions/routes/` (`botApi`, `music`, `debug`, `stream`,
`suggestions`, `wssever`). The `/ping` command reaches back into this server to report web-control health.

### ZiPlayer web-audio stream API

The bot can run an authenticated, independent ZiPlayer web-audio session for each logged-in user. The browser path is
server-authoritative and uses the normal `Readable -> AudioResource.volume -> AudioPlayer -> Opus` flow; it does not replace or
interrupt that user's Discord voice player. Use the JWT returned by the existing `/auth/token` or Discord callback flow as a
Bearer token for playback requests:

- `POST /api/stream/play` with `{"query":"..."}` starts or queues a track.
- `GET /api/stream/state` keeps an authenticated Server-Sent Events connection open, sends an initial `player-state` event, and
  publishes updated player state as tracks, queue, or playback controls change.
- `POST /api/stream/control` accepts `pause`, `resume`, `stop`, `skip`, `seek` (`positionMs`), `volume` (`volume`, 0-200), `loop`
  (`mode`: `off`, `track`, or `queue`), and `autoplay` (`enabled`).
- Connect a WebSocket to `/ws/stream`, then send `{"type":"auth","token":"<JWT>"}` as its first message. On success, the server
  relays the active Opus stream and ZI v1 control/config frames while playback is active; do not add a browser-side `GainNode` or
  duplicate local volume layer.

The stream session is scoped to the JWT's Discord user ID. WebSocket listeners must authenticate before receiving audio, and an
idle stream player is destroyed after 100 seconds without listeners.

## Key Conventions

- **Module exports always carry `data`** (`data.name`, `data.type`, etc.) — this is how the loader validates and registers them.
- **Global state is threaded through zihooks**, not passed between files: read with `useHooks.get("key")`. Do not `require`
  collections directly.
- **Interactions are pre-deferred**: in command handlers prefer `interaction.editReply(...)` over `reply(...)` (see the
  `bindMessenger` note above); the dispatcher already deferred.
- **Adding/removing functionality is just adding/removing a file** in the corresponding directory — no registration code.
- **UI components are pure Discord.js builders** (`EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `ModalBuilder`, …) — no UI
  framework/library.
- **Music**: any interaction needing a player (voice control) marks its command `data.category = "musix"` so the dispatcher
  injects `player` into `execute`.
- **Permissions and cooldowns**: `OwnerID` bypasses permission, ban, and cooldown checks; the default cooldown duration is
  `config.defaultCooldownDuration` (3000 ms by default).
- Tests use the built-in `node:test` runner and stub out `StartupManager` web/player-net side effects (`createTestManager`); temp
  dirs are used for loader assertions.
