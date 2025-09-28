# Creating Commands - App Class System

## Overview

This guide explains how to create commands for Ziji Bot Discord using the App Class System. All commands have access to the full
App context through `this` binding.

## Command Structure

### Basic Command Template

```javascript
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

const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports.data = {
	name: "command_name",
	description: "Command description",
	type: 1, // Slash command
	options: [
		{
			name: "option_name",
			description: "Option description",
			type: 3, // String type
			required: true,
		},
	],
	category: "utility", // Optional category
	nsfw: false, // Optional NSFW flag
};

/**
 * Execute the command
 * @param {Object} command - Command object
 * @param {import("discord.js").CommandInteraction} command.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} command.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// Access App services through this context
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	try {
		// Your command logic here
		const embed = new EmbedBuilder().setTitle("Command Response").setDescription("Hello from the command!").setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });

		// Log the command usage
		logger.info(`Command ${this.data.name} used by ${interaction.user.username}`);
	} catch (error) {
		logger.error(`Error in command ${this.data.name}:`, error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
};
```

## Available Services

### Core Services

- `this.client` - Discord client instance
- `this.config` - Bot configuration
- `this.logger` - Logger instance
- `this.db` - Database instance

### Collections

- `this.commands` - Commands collection
- `this.functions` - Functions collection
- `this.cooldowns` - Cooldowns collection
- `this.responder` - Autoresponder collection
- `this.welcome` - Welcome collection

### Specialized Services

- `this.manager` - Player manager (for music)
- `this.giveaways` - Giveaways manager

## Command Types

### 1. Slash Commands (Type 1)

```javascript
module.exports.data = {
	name: "ping",
	description: "Check bot latency",
	type: 1,
	options: [
		{
			name: "ephemeral",
			description: "Make response ephemeral",
			type: 5, // Boolean
			required: false,
		},
	],
};
```

### 2. User Context Menu (Type 2)

```javascript
module.exports.data = {
	name: "Get User Info",
	description: "Get information about a user",
	type: 2,
};
```

### 3. Message Context Menu (Type 3)

```javascript
module.exports.data = {
	name: "Quote Message",
	description: "Quote this message",
	type: 3,
};
```

## Command Options

### Option Types

- `3` - String
- `4` - Integer
- `5` - Boolean
- `6` - User
- `7` - Channel
- `8` - Role
- `9` - Mentionable
- `10` - Number

### Example with Multiple Options

```javascript
module.exports.data = {
	name: "userinfo",
	description: "Get user information",
	type: 1,
	options: [
		{
			name: "user",
			description: "User to get info about",
			type: 6, // User
			required: false,
		},
		{
			name: "show_avatar",
			description: "Show user avatar",
			type: 5, // Boolean
			required: false,
		},
	],
};
```

## Database Operations

### Using Database

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const db = this.db;

	try {
		// Find user
		const user = await db.ZiUser.findOne({ userId: interaction.user.id });

		if (!user) {
			// Create new user
			const newUser = new db.ZiUser({
				userId: interaction.user.id,
				username: interaction.user.username,
				coins: 1000,
				level: 1,
				xp: 0,
			});
			await newUser.save();
		}

		// Update user data
		user.coins += 100;
		await user.save();
	} catch (error) {
		this.logger.error("Database error:", error);
	}
};
```

## Error Handling

### Basic Error Handling

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	try {
		// Your command logic
	} catch (error) {
		this.logger.error(`Error in ${this.data.name}:`, error);

		const errorEmbed = new EmbedBuilder()
			.setTitle("Error")
			.setDescription("An error occurred while executing this command.")
			.setColor("#ff0000");

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
		} else {
			await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
		}
	}
};
```

## Cooldowns

### Using Cooldowns

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const userId = interaction.user.id;
	const cooldownTime = 5000; // 5 seconds

	// Check cooldown
	if (this.cooldowns.has(userId)) {
		const expirationTime = this.cooldowns.get(userId) + cooldownTime;
		if (Date.now() < expirationTime) {
			const timeLeft = (expirationTime - Date.now()) / 1000;
			return await interaction.reply({
				content: `Please wait ${timeLeft.toFixed(1)} seconds before using this command again.`,
				ephemeral: true,
			});
		}
	}

	// Set cooldown
	this.cooldowns.set(userId, Date.now());
	setTimeout(() => this.cooldowns.delete(userId), cooldownTime);

	// Your command logic here
};
```

## Music Commands

### Music Command Template

```javascript
module.exports.data = {
	name: "play",
	description: "Play music",
	type: 1,
	options: [
		{
			name: "query",
			description: "Song name or URL",
			type: 3,
			required: true,
		},
	],
	category: "musix",
	lock: true, // Requires player to be locked
	ckeckVoice: true, // Requires user to be in same voice channel
};

module.exports.execute = async function ({ interaction, lang, player, status }) {
	if (!status.status) return;

	const query = interaction.options.getString("query");
	const searchPlayer = this.manager.get("search");

	try {
		const result = await searchPlayer.search(query, {
			requester: interaction.user,
		});

		if (result.tracks.length === 0) {
			return await interaction.reply({
				content: "No results found!",
				ephemeral: true,
			});
		}

		const track = result.tracks[0];
		player.queue.add(track);

		if (!player.playing) {
			await player.play();
		}

		const embed = new EmbedBuilder()
			.setTitle("Added to Queue")
			.setDescription(`[${track.title}](${track.url})`)
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		this.logger.error("Music command error:", error);
		await interaction.reply({
			content: "An error occurred while playing music.",
			ephemeral: true,
		});
	}
};
```

## Best Practices

### 1. Always Use Try-Catch

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	try {
		// Your logic
	} catch (error) {
		this.logger.error("Command error:", error);
		// Handle error
	}
};
```

### 2. Check Permissions

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return await interaction.reply({
			content: "You don't have permission to use this command.",
			ephemeral: true,
		});
	}

	// Your logic
};
```

### 3. Use Embeds for Rich Responses

```javascript
const embed = new EmbedBuilder()
	.setTitle("Title")
	.setDescription("Description")
	.setColor("#00ff00")
	.setTimestamp()
	.setFooter({ text: `Requested by ${interaction.user.tag}` });

await interaction.reply({ embeds: [embed] });
```

### 4. Log Important Actions

```javascript
this.logger.info(`User ${interaction.user.username} used command ${this.data.name}`);
```

## File Organization

### Commands Directory Structure

```
commands/
├── config/
│   └── language.js
├── fun/
│   ├── ai.js
│   └── avatar.js
├── games/
│   ├── battle.js
│   └── cookie.js
├── moderation/
│   ├── ban.js
│   └── kick.js
├── music/
│   ├── play.js
│   └── stop.js
├── owner/
│   ├── eval.js
│   └── shutdown.js
└── utility/
    ├── help.js
    └── ping.js
```

## Testing Commands

### Local Testing

1. Start the bot in development mode
2. Use `/deploy` command to register slash commands
3. Test the command in Discord
4. Check logs for any errors

### Production Deployment

1. Ensure all commands are properly tested
2. Use the deploy script to register commands
3. Monitor logs for any issues

## Troubleshooting

### Common Issues

1. **Command not found**: Check if the command is properly registered in the commands collection
2. **Permission denied**: Verify user has required permissions
3. **Database errors**: Check database connection and model definitions
4. **Type errors**: Ensure proper JSDoc types are used

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different user permissions

---

**This guide covers the basics of creating commands with the App Class System. For more advanced features, refer to the specific
documentation for each service.**
