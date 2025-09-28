# Creating Modals - App Class System

## Overview

This guide explains how to create modal interactions for Ziji Bot Discord using the App Class System. Modals are popup forms that
allow users to input text data.

## Modal Structure

### Basic Modal Template

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

const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
	name: "modal_name",
	description: "Modal description",
	type: "modal",
	category: "utility", // Optional category
};

/**
 * Execute the modal interaction
 * @param {Object} modal - Modal object
 * @param {import("discord.js").ModalSubmitInteraction} modal.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} modal.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// Access App services through this context
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	try {
		// Get form data
		const input1 = interaction.fields.getTextInputValue("input1");
		const input2 = interaction.fields.getTextInputValue("input2");

		// Your modal logic here
		const embed = new EmbedBuilder()
			.setTitle("Modal Submitted!")
			.setDescription(`Input 1: ${input1}\nInput 2: ${input2}`)
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });

		// Log the modal usage
		logger.info(`Modal ${this.name} submitted by ${interaction.user.username}`);
	} catch (error) {
		logger.error(`Error in modal ${this.name}:`, error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
};
```

## Text Input Types

### 1. Short Text Input

```javascript
const shortInput = new TextInputBuilder()
	.setCustomId("short_input")
	.setLabel("Short Input")
	.setStyle(TextInputStyle.Short)
	.setPlaceholder("Enter short text...")
	.setRequired(true)
	.setMaxLength(100);
```

### 2. Paragraph Text Input

```javascript
const paragraphInput = new TextInputBuilder()
	.setCustomId("paragraph_input")
	.setLabel("Paragraph Input")
	.setStyle(TextInputStyle.Paragraph)
	.setPlaceholder("Enter long text...")
	.setRequired(false)
	.setMaxLength(1000);
```

## Creating Modals

### Basic Modal

```javascript
const modal = new ModalBuilder().setCustomId("basic_modal").setTitle("Basic Modal");

const shortInput = new TextInputBuilder()
	.setCustomId("short_input")
	.setLabel("Short Input")
	.setStyle(TextInputStyle.Short)
	.setRequired(true);

const paragraphInput = new TextInputBuilder()
	.setCustomId("paragraph_input")
	.setLabel("Paragraph Input")
	.setStyle(TextInputStyle.Paragraph)
	.setRequired(false);

const firstActionRow = new ActionRowBuilder().addComponents(shortInput);
const secondActionRow = new ActionRowBuilder().addComponents(paragraphInput);

modal.addComponents(firstActionRow, secondActionRow);
```

### Modal with Multiple Inputs

```javascript
const modal = new ModalBuilder().setCustomId("multi_input_modal").setTitle("Multiple Inputs");

// Name input
const nameInput = new TextInputBuilder()
	.setCustomId("name_input")
	.setLabel("Name")
	.setStyle(TextInputStyle.Short)
	.setPlaceholder("Enter your name...")
	.setRequired(true)
	.setMaxLength(50);

// Email input
const emailInput = new TextInputBuilder()
	.setCustomId("email_input")
	.setLabel("Email")
	.setStyle(TextInputStyle.Short)
	.setPlaceholder("Enter your email...")
	.setRequired(true)
	.setMaxLength(100);

// Message input
const messageInput = new TextInputBuilder()
	.setCustomId("message_input")
	.setLabel("Message")
	.setStyle(TextInputStyle.Paragraph)
	.setPlaceholder("Enter your message...")
	.setRequired(false)
	.setMaxLength(1000);

// Add inputs to action rows
const nameRow = new ActionRowBuilder().addComponents(nameInput);
const emailRow = new ActionRowBuilder().addComponents(emailInput);
const messageRow = new ActionRowBuilder().addComponents(messageInput);

modal.addComponents(nameRow, emailRow, messageRow);
```

## Modal with Validation

### Validation Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const name = interaction.fields.getTextInputValue("name_input");
	const email = interaction.fields.getTextInputValue("email_input");
	const message = interaction.fields.getTextInputValue("message_input");

	// Validate inputs
	const errors = [];

	if (!name || name.length < 2) {
		errors.push("Name must be at least 2 characters long.");
	}

	if (!email || !email.includes("@")) {
		errors.push("Please enter a valid email address.");
	}

	if (message && message.length > 1000) {
		errors.push("Message must be less than 1000 characters.");
	}

	if (errors.length > 0) {
		const errorEmbed = new EmbedBuilder().setTitle("Validation Errors").setDescription(errors.join("\n")).setColor("#ff0000");

		return await interaction.reply({
			embeds: [errorEmbed],
			ephemeral: true,
		});
	}

	// Process valid data
	const embed = new EmbedBuilder()
		.setTitle("Form Submitted Successfully")
		.setDescription(`Name: ${name}\nEmail: ${email}\nMessage: ${message}`)
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });
};
```

## Modal with Database Operations

### Database Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const db = this.db;

	try {
		const username = interaction.fields.getTextInputValue("username_input");
		const bio = interaction.fields.getTextInputValue("bio_input");
		const userId = interaction.user.id;

		// Update user profile
		const user = await db.ZiUser.findOne({ userId });
		if (user) {
			user.username = username;
			user.bio = bio;
			user.updatedAt = new Date();
			await user.save();
		} else {
			// Create new user
			const newUser = new db.ZiUser({
				userId,
				username,
				bio,
				coins: 1000,
				level: 1,
				xp: 0,
			});
			await newUser.save();
		}

		const embed = new EmbedBuilder()
			.setTitle("Profile Updated")
			.setDescription(`Username: ${username}\nBio: ${bio}`)
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		this.logger.error("Database modal error:", error);
		await interaction.reply({
			content: "An error occurred while updating your profile!",
			ephemeral: true,
		});
	}
};
```

## Modal with File Upload Simulation

### File Upload Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const fileName = interaction.fields.getTextInputValue("file_name");
	const fileContent = interaction.fields.getTextInputValue("file_content");
	const fileType = interaction.fields.getTextInputValue("file_type");

	// Simulate file processing
	const fileSize = Buffer.byteLength(fileContent, "utf8");
	const maxSize = 1024 * 1024; // 1MB limit

	if (fileSize > maxSize) {
		return await interaction.reply({
			content: "File size exceeds 1MB limit!",
			ephemeral: true,
		});
	}

	// Process the file
	const embed = new EmbedBuilder()
		.setTitle("File Uploaded Successfully")
		.setDescription(`**File Name:** ${fileName}\n**Type:** ${fileType}\n**Size:** ${(fileSize / 1024).toFixed(2)} KB`)
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });

	// Log file upload
	this.logger.info(`File uploaded by ${interaction.user.username}: ${fileName}`);
};
```

## Modal with Dynamic Content

### Dynamic Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	// Parse custom ID for context
	const [action, targetId] = customId.split("_");

	switch (action) {
		case "edit":
			await handleEdit(interaction, targetId, db);
			break;
		case "create":
			await handleCreate(interaction, db);
			break;
		case "delete":
			await handleDelete(interaction, targetId, db);
			break;
	}
};

async function handleEdit(interaction, targetId, db) {
	const newName = interaction.fields.getTextInputValue("name_input");
	const newDescription = interaction.fields.getTextInputValue("description_input");

	try {
		// Update the item
		const item = await db.ZiItem.findById(targetId);
		if (item) {
			item.name = newName;
			item.description = newDescription;
			item.updatedAt = new Date();
			await item.save();

			const embed = new EmbedBuilder()
				.setTitle("Item Updated")
				.setDescription(`**Name:** ${newName}\n**Description:** ${newDescription}`)
				.setColor("#00ff00");

			await interaction.reply({ embeds: [embed] });
		} else {
			await interaction.reply({
				content: "Item not found!",
				ephemeral: true,
			});
		}
	} catch (error) {
		this.logger.error("Edit modal error:", error);
		await interaction.reply({
			content: "An error occurred while updating the item!",
			ephemeral: true,
		});
	}
}
```

## Modal with Confirmation

### Confirmation Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const confirmText = interaction.fields.getTextInputValue("confirm_input");
	const action = interaction.fields.getTextInputValue("action_input");

	// Check if user typed the confirmation text correctly
	if (confirmText !== "CONFIRM") {
		return await interaction.reply({
			content: "You must type 'CONFIRM' to proceed!",
			ephemeral: true,
		});
	}

	// Perform the action
	const embed = new EmbedBuilder()
		.setTitle("Action Confirmed")
		.setDescription(`Action: ${action}\nStatus: Completed successfully!`)
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });

	// Log the action
	this.logger.info(`Action ${action} confirmed by ${interaction.user.username}`);
};
```

## Modal with Error Handling

### Error Handling Modal

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	try {
		const input1 = interaction.fields.getTextInputValue("input1");
		const input2 = interaction.fields.getTextInputValue("input2");

		// Validate inputs
		if (!input1 || !input2) {
			throw new Error("All fields are required!");
		}

		if (input1.length < 3) {
			throw new Error("Input 1 must be at least 3 characters long!");
		}

		if (input2.length > 100) {
			throw new Error("Input 2 must be less than 100 characters!");
		}

		// Process the data
		const result = await processData(input1, input2);

		const embed = new EmbedBuilder().setTitle("Success").setDescription(`Result: ${result}`).setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		this.logger.error("Modal error:", error);

		const errorEmbed = new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor("#ff0000");

		await interaction.reply({
			embeds: [errorEmbed],
			ephemeral: true,
		});
	}
};

async function processData(input1, input2) {
	// Simulate data processing
	return `Processed: ${input1} + ${input2}`;
}
```

## Best Practices

### 1. Use Descriptive Custom IDs

```javascript
// Good
.setCustomId("edit_user_profile_123456789")

// Bad
.setCustomId("modal1")
```

### 2. Validate All Inputs

```javascript
const name = interaction.fields.getTextInputValue("name_input");
if (!name || name.length < 2) {
	throw new Error("Name must be at least 2 characters long!");
}
```

### 3. Use Appropriate Text Input Styles

```javascript
// Short text for names, emails, etc.
.setStyle(TextInputStyle.Short)

// Paragraph for descriptions, messages, etc.
.setStyle(TextInputStyle.Paragraph)
```

### 4. Set Reasonable Limits

```javascript
.setMaxLength(100) // For short inputs
.setMaxLength(1000) // For paragraph inputs
```

### 5. Handle Errors Gracefully

```javascript
try {
	// Your logic
} catch (error) {
	this.logger.error("Modal error:", error);
	await interaction.reply({
		content: "An error occurred!",
		ephemeral: true,
	});
}
```

### 6. Use Ephemeral Responses for Sensitive Data

```javascript
await interaction.reply({
	content: "Data processed successfully!",
	ephemeral: true,
});
```

## File Organization

### Modals Directory Structure

```
functions/modal/
├── M_edit_profile.js
├── M_create_item.js
├── M_confirm_action.js
├── M_feedback_form.js
└── M_admin_settings.js
```

## Testing Modals

### Local Testing

1. Create a command that shows a modal
2. Fill out the modal form
3. Submit and check the response
4. Test validation and error handling

### Production Testing

1. Deploy the bot with new modals
2. Test in a Discord server
3. Monitor logs for errors
4. Test edge cases and validation

## Troubleshooting

### Common Issues

1. **Modal not showing**: Check if the modal is properly registered in the functions collection
2. **Validation errors**: Ensure all required fields are properly validated
3. **Database errors**: Check database connection and model definitions
4. **Timeout errors**: Ensure modals are handled within Discord's timeout limits

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different input values

---

**This guide covers the basics of creating modals with the App Class System. For more advanced features, refer to the specific
documentation for each service.**
