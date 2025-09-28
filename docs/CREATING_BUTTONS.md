# Creating Buttons - App Class System

## Overview

This guide explains how to create button interactions for Ziji Bot Discord using the App Class System. Buttons are interactive
components that respond to user clicks.

## Button Structure

### Basic Button Template

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

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
	name: "button_name",
	description: "Button description",
	type: "button",
	category: "utility", // Optional category
};

/**
 * Execute the button interaction
 * @param {Object} button - Button object
 * @param {import("discord.js").ButtonInteraction} button.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} button.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// Access App services through this context
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	try {
		// Your button logic here
		const embed = new EmbedBuilder().setTitle("Button Clicked!").setDescription("You clicked the button!").setColor("#00ff00");

		await interaction.reply({ embeds: [embed], ephemeral: true });

		// Log the button usage
		logger.info(`Button ${this.name} clicked by ${interaction.user.username}`);
	} catch (error) {
		logger.error(`Error in button ${this.name}:`, error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
};
```

## Button Types

### 1. Primary Button

```javascript
const button = new ButtonBuilder().setCustomId("primary_button").setLabel("Primary").setStyle(ButtonStyle.Primary);
```

### 2. Secondary Button

```javascript
const button = new ButtonBuilder().setCustomId("secondary_button").setLabel("Secondary").setStyle(ButtonStyle.Secondary);
```

### 3. Success Button

```javascript
const button = new ButtonBuilder().setCustomId("success_button").setLabel("Success").setStyle(ButtonStyle.Success);
```

### 4. Danger Button

```javascript
const button = new ButtonBuilder().setCustomId("danger_button").setLabel("Danger").setStyle(ButtonStyle.Danger);
```

### 5. Link Button

```javascript
const button = new ButtonBuilder().setURL("https://example.com").setLabel("Visit Website").setStyle(ButtonStyle.Link);
```

## Button with Emoji

```javascript
const button = new ButtonBuilder().setCustomId("emoji_button").setLabel("Click Me").setEmoji("🎉").setStyle(ButtonStyle.Primary);
```

## Button with Disabled State

```javascript
const button = new ButtonBuilder()
	.setCustomId("disabled_button")
	.setLabel("Disabled")
	.setStyle(ButtonStyle.Primary)
	.setDisabled(true);
```

## Creating Button Rows

### Single Button Row

```javascript
const row = new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId("button1").setLabel("Button 1").setStyle(ButtonStyle.Primary),
	new ButtonBuilder().setCustomId("button2").setLabel("Button 2").setStyle(ButtonStyle.Secondary),
);
```

### Multiple Button Rows

```javascript
const row1 = new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId("button1").setLabel("Button 1").setStyle(ButtonStyle.Primary),
	new ButtonBuilder().setCustomId("button2").setLabel("Button 2").setStyle(ButtonStyle.Secondary),
);

const row2 = new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId("button3").setLabel("Button 3").setStyle(ButtonStyle.Success),
	new ButtonBuilder().setCustomId("button4").setLabel("Button 4").setStyle(ButtonStyle.Danger),
);

const components = [row1, row2];
```

## Button Interaction Handling

### Basic Button Handler

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;

	switch (customId) {
		case "button1":
			await handleButton1(interaction);
			break;
		case "button2":
			await handleButton2(interaction);
			break;
		default:
			await interaction.reply({ content: "Unknown button!", ephemeral: true });
	}
};

async function handleButton1(interaction) {
	const embed = new EmbedBuilder().setTitle("Button 1 Clicked").setDescription("You clicked button 1!").setColor("#00ff00");

	await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleButton2(interaction) {
	const embed = new EmbedBuilder().setTitle("Button 2 Clicked").setDescription("You clicked button 2!").setColor("#ff0000");

	await interaction.reply({ embeds: [embed], ephemeral: true });
}
```

## Button with Confirmation

### Confirmation Button

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;

	if (customId === "confirm_action") {
		// Perform the action
		const embed = new EmbedBuilder()
			.setTitle("Action Confirmed")
			.setDescription("The action has been performed successfully!")
			.setColor("#00ff00");

		await interaction.update({
			embeds: [embed],
			components: [], // Remove buttons
		});
	} else if (customId === "cancel_action") {
		// Cancel the action
		const embed = new EmbedBuilder()
			.setTitle("Action Cancelled")
			.setDescription("The action has been cancelled.")
			.setColor("#ff0000");

		await interaction.update({
			embeds: [embed],
			components: [], // Remove buttons
		});
	}
};
```

## Button with Dynamic Content

### Dynamic Button Handler

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;

	// Parse custom ID for parameters
	const [action, userId, value] = customId.split("_");

	switch (action) {
		case "give":
			await handleGive(interaction, userId, value);
			break;
		case "take":
			await handleTake(interaction, userId, value);
			break;
		default:
			await interaction.reply({ content: "Unknown action!", ephemeral: true });
	}
};

async function handleGive(interaction, userId, value) {
	const db = this.db;
	const amount = parseInt(value);

	try {
		const user = await db.ZiUser.findOne({ userId });
		if (user) {
			user.coins += amount;
			await user.save();

			const embed = new EmbedBuilder()
				.setTitle("Coins Given")
				.setDescription(`Gave ${amount} coins to user!`)
				.setColor("#00ff00");

			await interaction.reply({ embeds: [embed] });
		}
	} catch (error) {
		this.logger.error("Error giving coins:", error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
}
```

## Button with Timeout

### Timeout Button Handler

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;

	// Check if button is still valid (not expired)
	const buttonData = this.buttonTimeouts.get(customId);
	if (!buttonData || Date.now() > buttonData.expires) {
		return await interaction.reply({
			content: "This button has expired!",
			ephemeral: true,
		});
	}

	// Handle the button click
	const embed = new EmbedBuilder().setTitle("Button Clicked").setDescription("Button is still valid!").setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });

	// Remove the button from timeout tracking
	this.buttonTimeouts.delete(customId);
};
```

## Button with User Permission Check

### Permission Check Button

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const userId = interaction.user.id;

	// Check if user has permission to use this button
	if (!this.config.OwnerID.includes(userId)) {
		return await interaction.reply({
			content: "You don't have permission to use this button!",
			ephemeral: true,
		});
	}

	// Handle the button click
	const embed = new EmbedBuilder()
		.setTitle("Admin Button Clicked")
		.setDescription("You have admin permissions!")
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });
};
```

## Button with Database Operations

### Database Button Handler

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	try {
		switch (customId) {
			case "save_data":
				await saveUserData(interaction, db);
				break;
			case "load_data":
				await loadUserData(interaction, db);
				break;
			case "delete_data":
				await deleteUserData(interaction, db);
				break;
		}
	} catch (error) {
		this.logger.error("Database button error:", error);
		await interaction.reply({ content: "Database error occurred!", ephemeral: true });
	}
};

async function saveUserData(interaction, db) {
	const userId = interaction.user.id;
	const userData = {
		userId,
		username: interaction.user.username,
		lastActive: new Date(),
	};

	await db.ZiUser.findOneAndUpdate({ userId }, userData, { upsert: true, new: true });

	const embed = new EmbedBuilder()
		.setTitle("Data Saved")
		.setDescription("Your data has been saved successfully!")
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });
}
```

## Button with Music Controls

### Music Button Handler

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const manager = this.manager;
	const player = manager.get(interaction.guild.id);

	if (!player) {
		return await interaction.reply({
			content: "No music is currently playing!",
			ephemeral: true,
		});
	}

	switch (customId) {
		case "play_pause":
			if (player.playing) {
				player.pause();
				await interaction.reply({ content: "⏸️ Music paused!" });
			} else {
				player.resume();
				await interaction.reply({ content: "▶️ Music resumed!" });
			}
			break;

		case "skip":
			player.skip();
			await interaction.reply({ content: "⏭️ Skipped to next song!" });
			break;

		case "stop":
			player.stop();
			await interaction.reply({ content: "⏹️ Music stopped!" });
			break;
	}
};
```

## Best Practices

### 1. Use Descriptive Custom IDs

```javascript
// Good
.setCustomId("confirm_delete_user_123456789")

// Bad
.setCustomId("btn1")
```

### 2. Handle Errors Gracefully

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	try {
		// Your logic
	} catch (error) {
		this.logger.error("Button error:", error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
};
```

### 3. Use Ephemeral Responses for Sensitive Actions

```javascript
await interaction.reply({
	content: "Action completed!",
	ephemeral: true,
});
```

### 4. Remove Buttons After Use

```javascript
await interaction.update({
	embeds: [embed],
	components: [], // Remove all buttons
});
```

### 5. Log Button Usage

```javascript
this.logger.info(`Button ${this.name} clicked by ${interaction.user.username}`);
```

## File Organization

### Buttons Directory Structure

```
functions/button/
├── B_confirm_action.js
├── B_cancel_action.js
├── B_music_play.js
├── B_music_pause.js
├── B_music_skip.js
├── B_user_profile.js
└── B_admin_panel.js
```

## Testing Buttons

### Local Testing

1. Create a command that sends a message with buttons
2. Click the buttons to test functionality
3. Check logs for any errors
4. Test with different user permissions

### Production Testing

1. Deploy the bot with new buttons
2. Test in a Discord server
3. Monitor logs for errors
4. Test edge cases and error conditions

## Troubleshooting

### Common Issues

1. **Button not responding**: Check if the button is registered in the functions collection
2. **Permission denied**: Verify user has required permissions
3. **Database errors**: Check database connection and model definitions
4. **Timeout errors**: Ensure buttons are handled within Discord's timeout limits

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different user permissions

---

**This guide covers the basics of creating buttons with the App Class System. For more advanced features, refer to the specific
documentation for each service.**
