# Contributing to Ziji Bot

Thank you for your interest in contributing! Please read this guide before submitting issues or pull requests.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Adding a Command](#adding-a-command)
- [Adding an Event](#adding-an-event)
- [Adding a Function](#adding-a-function)
- [Adding an Extension](#adding-an-extension)
- [Commit & PR Guidelines](#commit--pr-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a respectful and inclusive
environment.

---

## Getting Started

### Prerequisites

- Node.js `v18+`
- MongoDB instance
- A Discord application & bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/ZiProject/Ziji-bot-discord.git
cd ziji-bot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
cp config.js.example config.js
# Fill in your token, MongoDB URI, OwnerID, etc.

# 4. Start the bot
node index.js
```

---

## Project Structure

```
commands/       Slash & context menu commands (grouped by category)
events/         Discord, process, console, and player event listeners
extensions/     Services that run once at startup
functions/      Interaction handlers for buttons, modals, and select menus
helper/         Template files — copy these when creating new modules
lang/           Language files (en.js, vi.js, ja.js)
startup/        Boot sequence — do not modify unless necessary
utility/        Canvas card generators
utils/          Standalone helper utilities
```

> See the full annotated structure in the [AI Reference Guide](./helper/AI_Reference_Guide.md).

---

## Adding a Command

1. Copy `helper/commands.js` into the correct `commands/<category>/` folder.
2. Fill in `module.exports.data`:

```js
module.exports.data = {
	name: "mycommand", // must be lowercase, no spaces
	description: "Does something cool",
	type: 1, // 1 = CHAT_INPUT slash command
	options: [], // Discord API option objects
	integration_types: [0, 1], // 0=Guild, 1=User
	contexts: [0, 1, 2],
	enable: true,
};
```

3. Implement `module.exports.execute` for slash usage and (optionally) `module.exports.run` for message command usage.
4. Re-run `node startup/deploy.js` to register the new command with Discord.

**Music commands** — add `category: "musix"` to `data` to receive the `player` object and enable voice/lock checks automatically.

---

## Adding an Event

1. Copy `helper/events.js` into the correct `events/<source>/` folder.
2. Set `name` to the exact event name (e.g. `"guildMemberAdd"`).
3. Use `once: true` for one-time events like `ready`.

```js
module.exports = {
	name: "guildMemberAdd",
	type: "events",
	enable: true,
	execute: async (member) => {
		// your logic
	},
};
```

Events are loaded automatically by `startup/loader.js` — no manual registration needed.

---

## Adding a Function

Functions handle button clicks, modal submissions, and select menus. The `name` field **must exactly match** the `customId` of the
Discord component.

1. Copy `helper/functions.js` into the correct `functions/<type>/` folder.
2. Set the correct naming prefix:

| Prefix | Type        |
| ------ | ----------- |
| `B_`   | Button      |
| `M_`   | Modal       |
| `S_`   | Select Menu |

```js
module.exports.data = {
	name: "B_myButton", // matches customId: "B_myButton"
	type: "any",
	enable: true,
};

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.reply({ content: "Button clicked!", ephemeral: true });
};
```

---

## Adding an Extension

Extensions run once when the bot starts. Use them for initializing external services, registering Express routes, seeding data,
etc.

1. Copy `helper/extensions.js` into `extensions/`.
2. Set `priority` (1–10) to control load order — lower runs first.

```js
module.exports.data = {
	name: "myExtension",
	type: "extension",
	enable: true,
	priority: 5,
};

module.exports.execute = async (client) => {
	// runs once at startup
};
```

---

## Commit & PR Guidelines

### Commit Messages

Use the format: `type: short description`

| Type       | When to use                          |
| ---------- | ------------------------------------ |
| `feat`     | New command, feature, or event       |
| `fix`      | Bug fix                              |
| `refactor` | Code cleanup without behavior change |
| `docs`     | Documentation only                   |
| `chore`    | Dependency updates, config changes   |

**Examples:**

```
feat: add /weather command
fix: cooldown not resetting after modal submit
docs: update CONTRIBUTING.md
```

### Pull Requests

- Target the `main` branch (or `dev` if it exists).
- Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) completely.
- One feature or fix per PR — keep changes focused.
- Run the formatter before submitting:

```bash
npx prettier --write .
```

- Do **not** commit `.env`, `config.js`, or any tokens/secrets.

---

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Steps to reproduce
- Expected vs actual behavior
- Bot version / Node.js version
- Any relevant error logs

---

## Requesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md). Include:

- A clear description of the feature
- Why it would be useful
- Any relevant examples or references

---

## Questions?

Open a [Discussion](../../discussions) or reach out via the support server linked in the README.
