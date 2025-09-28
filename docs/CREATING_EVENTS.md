# Creating Events - App Class System

## Overview

This guide explains how to create event handlers for Ziji Bot Discord using the App Class System. Events respond to Discord API
events and other bot events.

## Event Structure

### Basic Event Template

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

const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.ClientReady, // Event name
	type: "events",
	once: true, // Run only once
	enable: true, // Enable/disable the event
};

/**
 * Execute the event
 * @param {import("discord.js").Client} client - Discord client
 * @this {ModuleContext}
 */
module.exports.execute = async function (client) {
	// Access App services through this context
	const logger = this.logger;
	const config = this.config;
	const db = this.db;

	try {
		// Your event logic here
		logger.info(`Bot is ready! Logged in as ${client.user.tag}`);

		// Set bot status
		client.user.setActivity("Ziji Bot", { type: "WATCHING" });
	} catch (error) {
		logger.error("Event error:", error);
	}
};
```

## Event Types

### 1. Client Events

```javascript
const { Events } = require("discord.js");

module.exports = {
	name: Events.MessageCreate, // Client event
	type: "events",
	once: false, // Run every time
};
```

### 2. Process Events

```javascript
module.exports = {
	name: "uncaughtException", // Process event
	type: "events",
	once: false,
};
```

### 3. Player Events

```javascript
module.exports = {
	name: "trackStart", // Player event
	type: "events",
	once: false,
};
```

## Common Event Examples

### 1. Message Create Event

```javascript
const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
};

module.exports.execute = async function (message) {
	const { client, user, guild, channel } = message;

	// Ignore bot messages
	if (user.bot) return;

	// Ignore DMs
	if (!guild) return;

	try {
		// Check for autoresponder
		const responder = this.responder.get(guild.id);
		if (responder) {
			const response = responder.getResponse(message.content);
			if (response) {
				await channel.send(response);
			}
		}

		// Log message
		this.logger.debug(`Message from ${user.username} in ${guild.name}: ${message.content}`);
	} catch (error) {
		this.logger.error("Message create event error:", error);
	}
};
```

### 2. Guild Member Add Event

```javascript
const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.GuildMemberAdd,
	type: "events",
};

module.exports.execute = async function (member) {
	const { guild, user } = member;

	try {
		// Get welcome configuration
		const welcomeConfig = this.welcome.get(guild.id);
		if (!welcomeConfig) return;

		// Get welcome channel
		const welcomeChannel = guild.channels.cache.get(welcomeConfig.channelId);
		if (!welcomeChannel) return;

		// Create welcome embed
		const embed = new EmbedBuilder()
			.setTitle("Welcome!")
			.setDescription(`Welcome to ${guild.name}, ${user.username}!`)
			.setThumbnail(user.displayAvatarURL())
			.setColor("#00ff00")
			.setTimestamp();

		// Send welcome message
		await welcomeChannel.send({ embeds: [embed] });

		// Log new member
		this.logger.info(`New member joined ${guild.name}: ${user.username}`);
	} catch (error) {
		this.logger.error("Guild member add event error:", error);
	}
};
```

### 3. Guild Member Remove Event

```javascript
const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.GuildMemberRemove,
	type: "events",
};

module.exports.execute = async function (member) {
	const { guild, user } = member;

	try {
		// Get leave configuration
		const leaveConfig = this.welcome.get(guild.id);
		if (!leaveConfig) return;

		// Get leave channel
		const leaveChannel = guild.channels.cache.get(leaveConfig.leaveChannelId);
		if (!leaveChannel) return;

		// Create leave embed
		const embed = new EmbedBuilder()
			.setTitle("Goodbye!")
			.setDescription(`${user.username} has left ${guild.name}`)
			.setThumbnail(user.displayAvatarURL())
			.setColor("#ff0000")
			.setTimestamp();

		// Send leave message
		await leaveChannel.send({ embeds: [embed] });

		// Log member leave
		this.logger.info(`Member left ${guild.name}: ${user.username}`);
	} catch (error) {
		this.logger.error("Guild member remove event error:", error);
	}
};
```

### 4. Voice State Update Event

```javascript
const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.VoiceStateUpdate,
	type: "events",
};

module.exports.execute = async function (oldState, newState) {
	const { member, guild } = newState;

	try {
		// Check if user joined a voice channel
		if (!oldState.channelId && newState.channelId) {
			this.logger.info(`${member.user.username} joined voice channel ${newState.channel.name}`);

			// Start music player if needed
			const player = this.manager.get(guild.id);
			if (player && !player.connection) {
				await player.connect(newState.channel);
			}
		}

		// Check if user left a voice channel
		if (oldState.channelId && !newState.channelId) {
			this.logger.info(`${member.user.username} left voice channel ${oldState.channel.name}`);

			// Disconnect music player if no one is in the channel
			const player = this.manager.get(guild.id);
			if (player && player.connection) {
				const voiceChannel = player.connection.channel;
				if (voiceChannel.members.size === 1) {
					// Only bot left
					await player.disconnect();
				}
			}
		}
	} catch (error) {
		this.logger.error("Voice state update event error:", error);
	}
};
```

## Player Events

### 1. Track Start Event

```javascript
const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "trackStart",
	type: "events",
};

module.exports.execute = async function (player, track) {
	const { guild } = player;

	try {
		// Get music channel
		const musicChannel = guild.channels.cache.get(player.textChannelId);
		if (!musicChannel) return;

		// Create now playing embed
		const embed = new EmbedBuilder()
			.setTitle("Now Playing")
			.setDescription(`[${track.title}](${track.url})`)
			.setThumbnail(track.thumbnail)
			.setColor("#00ff00")
			.setTimestamp();

		// Send now playing message
		await musicChannel.send({ embeds: [embed] });

		// Log track start
		this.logger.info(`Now playing in ${guild.name}: ${track.title}`);
	} catch (error) {
		this.logger.error("Track start event error:", error);
	}
};
```

### 2. Queue End Event

```javascript
const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "queueEnd",
	type: "events",
};

module.exports.execute = async function (player) {
	const { guild } = player;

	try {
		// Get music channel
		const musicChannel = guild.channels.cache.get(player.textChannelId);
		if (!musicChannel) return;

		// Create queue end embed
		const embed = new EmbedBuilder()
			.setTitle("Queue Ended")
			.setDescription("The music queue has ended. Add more songs to continue!")
			.setColor("#ff0000")
			.setTimestamp();

		// Send queue end message
		await musicChannel.send({ embeds: [embed] });

		// Log queue end
		this.logger.info(`Queue ended in ${guild.name}`);
	} catch (error) {
		this.logger.error("Queue end event error:", error);
	}
};
```

## Process Events

### 1. Uncaught Exception Event

```javascript
module.exports = {
	name: "uncaughtException",
	type: "events",
};

module.exports.execute = async function (error) {
	try {
		// Log the error
		this.logger.error("Uncaught Exception:", error);

		// Send error to error channel if configured
		if (this.config.botConfig?.ErrorLog) {
			const errorChannel = this.client.channels.cache.get(this.config.botConfig.ErrorLog);
			if (errorChannel) {
				await errorChannel.send({
					content: `**Uncaught Exception:**\n\`\`\`\n${error.stack}\n\`\`\``,
				});
			}
		}

		// Exit process
		process.exit(1);
	} catch (logError) {
		console.error("Error logging uncaught exception:", logError);
		process.exit(1);
	}
};
```

### 2. Unhandled Rejection Event

```javascript
module.exports = {
	name: "unhandledRejection",
	type: "events",
};

module.exports.execute = async function (reason, promise) {
	try {
		// Log the error
		this.logger.error("Unhandled Rejection:", reason);

		// Send error to error channel if configured
		if (this.config.botConfig?.ErrorLog) {
			const errorChannel = this.client.channels.cache.get(this.config.botConfig.ErrorLog);
			if (errorChannel) {
				await errorChannel.send({
					content: `**Unhandled Rejection:**\n\`\`\`\n${reason}\n\`\`\``,
				});
			}
		}
	} catch (logError) {
		console.error("Error logging unhandled rejection:", logError);
	}
};
```

## Console Events

### 1. Console Line Event

```javascript
const readline = require("readline");

module.exports = {
	name: "line",
	type: "events",
};

module.exports.execute = async function (line) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const input = line.trim().toLowerCase();

		switch (input) {
			case "help":
				console.log("Available commands:");
				console.log("- help: Show this help");
				console.log("- status: Show bot status");
				console.log("- restart: Restart the bot");
				console.log("- shutdown: Shutdown the bot");
				break;

			case "status":
				console.log("Bot Status:");
				console.log(`- Guilds: ${this.client.guilds.cache.size}`);
				console.log(`- Users: ${this.client.users.cache.size}`);
				console.log(`- Commands: ${this.commands.size}`);
				console.log(`- Functions: ${this.functions.size}`);
				break;

			case "restart":
				console.log("Restarting bot...");
				process.exit(0);
				break;

			case "shutdown":
				console.log("Shutting down bot...");
				process.exit(0);
				break;

			default:
				console.log("Unknown command. Type 'help' for available commands.");
		}
	} catch (error) {
		this.logger.error("Console line event error:", error);
	}
};
```

## Event with Database Operations

### Database Event

```javascript
const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
	name: Events.GuildCreate,
	type: "events",
};

module.exports.execute = async function (guild) {
	const db = this.db;

	try {
		// Create guild record
		const guildData = new db.ZiGuild({
			guildId: guild.id,
			name: guild.name,
			ownerId: guild.ownerId,
			memberCount: guild.memberCount,
			joinedAt: new Date(),
		});

		await guildData.save();

		// Log guild join
		this.logger.info(`Bot joined new guild: ${guild.name} (${guild.id})`);

		// Send welcome message to owner
		const owner = await guild.members.fetch(guild.ownerId);
		if (owner) {
			const embed = new EmbedBuilder()
				.setTitle("Thanks for adding Ziji Bot!")
				.setDescription("Use `/help` to get started with the bot.")
				.setColor("#00ff00");

			await owner.send({ embeds: [embed] }).catch(() => {});
		}
	} catch (error) {
		this.logger.error("Guild create event error:", error);
	}
};
```

## Best Practices

### 1. Always Use Try-Catch

```javascript
module.exports.execute = async function (...args) {
	try {
		// Your event logic
	} catch (error) {
		this.logger.error("Event error:", error);
	}
};
```

### 2. Check for Required Data

```javascript
module.exports.execute = async function (message) {
	if (!message.guild) return; // Ignore DMs
	if (message.author.bot) return; // Ignore bots
	if (!message.content) return; // Ignore empty messages
};
```

### 3. Use Appropriate Logging

```javascript
// Debug level for detailed information
this.logger.debug(`User ${user.username} performed action`);

// Info level for important events
this.logger.info(`Bot joined guild: ${guild.name}`);

// Error level for errors
this.logger.error("Event error:", error);
```

### 4. Handle Errors Gracefully

```javascript
try {
	// Your logic
} catch (error) {
	this.logger.error("Event error:", error);
	// Don't crash the bot
}
```

### 5. Use Database Operations Carefully

```javascript
try {
	const user = await db.ZiUser.findOne({ userId: user.id });
	if (user) {
		// Update existing user
		user.lastSeen = new Date();
		await user.save();
	} else {
		// Create new user
		const newUser = new db.ZiUser({
			userId: user.id,
			username: user.username,
		});
		await newUser.save();
	}
} catch (error) {
	this.logger.error("Database error:", error);
}
```

## File Organization

### Events Directory Structure

```
events/
├── client/
│   ├── ready.js
│   ├── messageCreate.js
│   ├── guildMemberAdd.js
│   └── voiceStateUpdate.js
├── player/
│   ├── trackStart.js
│   ├── queueEnd.js
│   └── playerError.js
├── process/
│   ├── uncaughtException.js
│   └── unhandledRejection.js
└── console/
    └── line.js
```

## Testing Events

### Local Testing

1. Start the bot in development mode
2. Trigger the event (send message, join voice, etc.)
3. Check logs for event execution
4. Verify database operations

### Production Testing

1. Deploy the bot with new events
2. Test in a Discord server
3. Monitor logs for errors
4. Test edge cases and error conditions

## Troubleshooting

### Common Issues

1. **Event not firing**: Check if the event is properly registered
2. **Database errors**: Check database connection and model definitions
3. **Permission errors**: Verify bot has required permissions
4. **Memory leaks**: Ensure proper cleanup in long-running events

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different event conditions

---

**This guide covers the basics of creating events with the App Class System. For more advanced features, refer to the specific
documentation for each service.**
