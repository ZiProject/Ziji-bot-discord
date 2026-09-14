# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ziji Bot (Zibot V10)** — a feature-rich Discord bot built with **discord.js** and the **ziplayer** music framework. It is actively developed; the codebase mixes English and Vietnamese (the bot targets Vietnamese users; strings often use `lang.<key>` lookups and fall back to `" "`).

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

Setup: copy `.env.example` → `.env` (fill `TOKEN`, optionally `MONGO`, `GEMINI_API_KEY`) and `config.js.example` → `config.js`. `MONGO` URI must include a database name (e.g. `/ziji`); `appName` is used as a fallback. `node_modules` is committed-tracked via `allowScripts`.

## Architecture

### Boot sequence (`index.js` → `startup/index.js`)
`index.js` creates the `discord.js` **Client** and a **PlayerManager** (ziplayer), then a `StartupManager` which:
1. Loads config (`config.js` or `startup/defaultconfig.js`), sets up a winston logger, an Express/web server (port `SERVER_PORT` or 2003) with WebSocket on `/ws`, and optional multi-player login via `MULTI_PLAYER_TOKEN`.
2. `initHooks()` seeds the global state store (**zihooks `useHooks`**) with central `Collection`s: `commands`, `Mcommands`, `functions`, `extensions`, `welcome`, `cooldowns`, `responder`, `temp`, `guildCommands`, plus `client`, `config`, `logger`, `db`, `wss`, `server`, `icon`, `loaders`.
3. `loadEvents(dir, target)` / `loadModules(dir, collection)` load every `.js` file recursively via `@ziji/loader`, with hot-reload (`watch: true`) in development. Module shapes are validated by a `check()` predicate; `disabledCommands` and `data.enable === false` skip registration.

### Module loading — the core pattern
The bot is file-driven. New functionality is added by dropping a file into the right directory; the loader picks it up. Do not register modules manually.

- **Slash / context / message commands**: `commands/<category>/<name>.js`. Each exports `data` (name, description, type, options, `integration_types`, `contexts`, optional `category: "musix"`, `lock`, `ckeckVoice`, `alias`, `enable`, `ephemeral`) and an `execute({ interaction, lang, player })`. A command may also export `run({ message, args, lang })` to support the legacy **message-command** path (prefix `z!`; see `helper/commands.js` for the canonical template).
- **Events**: `events/<domain>/<name>.js`. Export `{ name, type: "events", once?, execute(...args) }`. Loaded onto `client`, `process`, a readline interface, or the player manager depending on the folder. Errors are caught and logged centrally.
- **Functions (UI interactions)**: `functions/<kind>/<customId>.js` where kind ∈ `button`, `modal`, `SelectMenu`, and also `utils`, `player`, `other`, `ranksys`, `ai`. Export `data.name = "<customId>"` (must match the interaction `customId`) and `execute({ interaction, lang, player })`. These handle button clicks, modals, and select menus.
- **Extensions (startup modules)**: `extensions/<name>.js`. Export `data = { name, type: "extension", enable, priority (1-10) }` and `execute(client)`. Run in priority order after login. Used for DB init, command deployment, ngrok/cloudflared tunnels, AI init, periodic jobs.
- **Guild commands**: custom per-guild slash commands managed through a builder UI (`functions/guildCommand/` + `utils/guildCommand*.js`), stored in the DB and registered at runtime into `guildCommands` keyed `guildId:name` (lowercased).

### Interaction→handler routing (`events/client/interactionCreate.js`)
The central dispatcher. Given an interaction, it resolves a module: chat/message/context commands from `Commands` (falling back to `guildCommands`), components/modals from `Functions` by `customId`. Chat and context commands are auto-`deferReply`ed via a `bindMessenger` wrapper that re-binds `interaction.reply`/`editReply` to the messenger's `edit` — so command code can use `editReply`/`reply` freely and the wrapper keeps flags correct. This is followed by permission/ban/cooldown checks (`checkStatus`), optional music-player checks (`checkMusicstat` for `category == "musix"`), XP/lang resolution, then `command.execute(...)`. `messageCommands.js` mirrors this for the prefix-based message path.

### Persistence (`startup/prismaDB.js`)
Abstraction over **Prisma** with a fallback chain: **MongoDB → SQLite → in-memory LocalDB** (`@zibot/db`). Exposed as `db` on hooks. Models are defined in both `prisma/mongo/schema.prisma` and SQL DDL in `prismaDB.js` (kept in sync manually — **update both when changing a model**). The exposed model classes (`db.ZiUser`, `db.ZiGuild`, …) provide a Mongoose-like API (`find`, `findOne`, `create`, `updateOne`, `findOneAndUpdate`, `findByIdAndUpdate`, `deleteOne`, `deleteMany`, `findByIdAndDelete`) supporting Mongo-ish operators (`$set`, `$inc`, `$push`, `$addToSet`, `$unset`, `$gte`, `$regex`, …). JSON fields are stored stringified in SQLite and hydrated automatically. Sensitive fields are redacted in `prisma_DEBUG` logs.

### Localization (`lang/`)
Per-language JS modules (`vi.js`, `en.js`, `ja.js`). User language is stored per-user in the DB; the `ZiRank` function resolves the `lang` object passed to every command. Access labels via `lang.<Group>.<Key>` with `|| " "` fallbacks — most labels are Vietnamese with English/Japanese equivalents.

### Config (`config.js` / `startup/defaultconfig.js`)
Central runtime config accessible via `useHooks.get("config")`: `prefix`, `OwnerID`, `botConfig` (status, activity, banners, error-log channel), `webAppConfig` (dashboard/music-controller URLs), `disabledCommands`, `defaultCooldownDuration`, `DevConfig` flags (e.g. `prisma_DEBUG`, `loaderDebug`).

### Web / dashboard
The bot runs an Express server (port 2003) plus WebSocket at `/ws` used by the external web dashboard and music controller. Routes live in `extensions/routes/` (`botApi`, `music`, `debug`, `stream`, `suggestions`, `wssever`). The `/ping` command reaches back into this server to report web-control health.

## Key Conventions

- **Module exports always carry `data`** (`data.name`, `data.type`, etc.) — this is how the loader validates and registers them.
- **Global state is threaded through zihooks**, not passed between files: read with `useHooks.get("key")`. Do not `require` collections directly.
- **Interactions are pre-deferred**: in command handlers prefer `interaction.editReply(...)` over `reply(...)` (see the `bindMessenger` note above); the dispatcher already deferred.
- **Adding/removing functionality is just adding/removing a file** in the corresponding directory — no registration code.
- **UI components are pure Discord.js builders** (`EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `ModalBuilder`, …) — no UI framework/library.
- **Music**: any interaction needing a player (voice control) marks its command `data.category = "musix"` so the dispatcher injects `player` into `execute`.
- Tests use the built-in `node:test` runner and stub out `StartupManager` web/player-net side effects (`createTestManager`); temp dirs are used for loader assertions.
