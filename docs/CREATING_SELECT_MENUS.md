# Creating Select Menus - App Class System

## Overview

This guide explains how to create select menu interactions for Ziji Bot Discord using the App Class System. Select menus allow
users to choose from a list of options.

## Select Menu Structure

### Basic Select Menu Template

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

const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");

module.exports = {
	name: "select_menu_name",
	description: "Select menu description",
	type: "SelectMenu",
	category: "utility", // Optional category
};

/**
 * Execute the select menu interaction
 * @param {Object} selectMenu - Select menu object
 * @param {import("discord.js").StringSelectMenuInteraction} selectMenu.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} selectMenu.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// Access App services through this context
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	try {
		// Get selected values
		const selectedValues = interaction.values;

		// Your select menu logic here
		const embed = new EmbedBuilder()
			.setTitle("Selection Made!")
			.setDescription(`You selected: ${selectedValues.join(", ")}`)
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed] });

		// Log the selection
		logger.info(`Select menu ${this.name} used by ${interaction.user.username}: ${selectedValues.join(", ")}`);
	} catch (error) {
		logger.error(`Error in select menu ${this.name}:`, error);
		await interaction.reply({ content: "An error occurred!", ephemeral: true });
	}
};
```

## Select Menu Types

### 1. String Select Menu

```javascript
const selectMenu = new StringSelectMenuBuilder()
	.setCustomId("string_select")
	.setPlaceholder("Choose an option...")
	.setMinValues(1)
	.setMaxValues(1)
	.addOptions([
		{
			label: "Option 1",
			description: "This is option 1",
			value: "option1",
			emoji: "1️⃣",
		},
		{
			label: "Option 2",
			description: "This is option 2",
			value: "option2",
			emoji: "2️⃣",
		},
	]);
```

### 2. Multi-Select Menu

```javascript
const selectMenu = new StringSelectMenuBuilder()
	.setCustomId("multi_select")
	.setPlaceholder("Choose multiple options...")
	.setMinValues(1)
	.setMaxValues(3) // Allow up to 3 selections
	.addOptions([
		{
			label: "Option 1",
			description: "This is option 1",
			value: "option1",
		},
		{
			label: "Option 2",
			description: "This is option 2",
			value: "option2",
		},
		{
			label: "Option 3",
			description: "This is option 3",
			value: "option3",
		},
	]);
```

## Creating Select Menus

### Basic Select Menu

```javascript
const selectMenu = new StringSelectMenuBuilder()
	.setCustomId("basic_select")
	.setPlaceholder("Choose an option...")
	.setMinValues(1)
	.setMaxValues(1)
	.addOptions([
		{
			label: "Help",
			description: "Get help information",
			value: "help",
			emoji: "❓",
		},
		{
			label: "Settings",
			description: "Configure bot settings",
			value: "settings",
			emoji: "⚙️",
		},
		{
			label: "Profile",
			description: "View your profile",
			value: "profile",
			emoji: "👤",
		},
	]);

const row = new ActionRowBuilder().addComponents(selectMenu);
```

### Dynamic Select Menu

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	// Parse custom ID for context
	const [action, page] = customId.split("_");

	switch (action) {
		case "user_list":
			await handleUserList(interaction, page, db);
			break;
		case "item_list":
			await handleItemList(interaction, page, db);
			break;
		case "category_list":
			await handleCategoryList(interaction, page, db);
			break;
	}
};

async function handleUserList(interaction, page, db) {
	const pageNum = parseInt(page) || 1;
	const limit = 10;
	const skip = (pageNum - 1) * limit;

	try {
		// Get users from database
		const users = await db.ZiUser.find().skip(skip).limit(limit).sort({ level: -1 });

		if (users.length === 0) {
			return await interaction.reply({
				content: "No users found!",
				ephemeral: true,
			});
		}

		// Create select menu options
		const options = users.map((user, index) => ({
			label: user.username || `User ${user.userId}`,
			description: `Level ${user.level} - ${user.coins} coins`,
			value: `user_${user.userId}`,
			emoji: `${index + 1}️⃣`,
		}));

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`user_select_${pageNum}`)
			.setPlaceholder("Select a user...")
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(options);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const embed = new EmbedBuilder()
			.setTitle("User List")
			.setDescription("Select a user to view their profile")
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed], components: [row] });
	} catch (error) {
		this.logger.error("User list error:", error);
		await interaction.reply({
			content: "An error occurred while loading users!",
			ephemeral: true,
		});
	}
}
```

## Select Menu with Pagination

### Paginated Select Menu

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	// Parse custom ID for pagination
	const [action, page, direction] = customId.split("_");
	const pageNum = parseInt(page) || 1;
	const limit = 10;

	try {
		// Get total count
		const totalCount = await db.ZiItem.countDocuments();
		const totalPages = Math.ceil(totalCount / limit);

		// Calculate new page
		let newPage = pageNum;
		if (direction === "next" && pageNum < totalPages) {
			newPage = pageNum + 1;
		} else if (direction === "prev" && pageNum > 1) {
			newPage = pageNum - 1;
		}

		// Get items for current page
		const skip = (newPage - 1) * limit;
		const items = await db.ZiItem.find().skip(skip).limit(limit).sort({ createdAt: -1 });

		if (items.length === 0) {
			return await interaction.reply({
				content: "No items found!",
				ephemeral: true,
			});
		}

		// Create select menu options
		const options = items.map((item, index) => ({
			label: item.name,
			description: item.description?.substring(0, 100) + "...",
			value: `item_${item._id}`,
			emoji: `${index + 1}️⃣`,
		}));

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`item_select_${newPage}`)
			.setPlaceholder(`Select an item (Page ${newPage}/${totalPages})...`)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(options);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const embed = new EmbedBuilder()
			.setTitle("Item List")
			.setDescription(`Page ${newPage} of ${totalPages} (${totalCount} total items)`)
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed], components: [row] });
	} catch (error) {
		this.logger.error("Paginated select menu error:", error);
		await interaction.reply({
			content: "An error occurred while loading items!",
			ephemeral: true,
		});
	}
};
```

## Select Menu with Search

### Searchable Select Menu

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	// Parse custom ID for search
	const [action, searchTerm, page] = customId.split("_");

	try {
		// Build search query
		const query =
			searchTerm ?
				{
					$or: [{ name: { $regex: searchTerm, $options: "i" } }, { description: { $regex: searchTerm, $options: "i" } }],
				}
			:	{};

		const pageNum = parseInt(page) || 1;
		const limit = 10;
		const skip = (pageNum - 1) * limit;

		// Get search results
		const items = await db.ZiItem.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });

		if (items.length === 0) {
			return await interaction.reply({
				content: searchTerm ? "No items found matching your search!" : "No items found!",
				ephemeral: true,
			});
		}

		// Create select menu options
		const options = items.map((item, index) => ({
			label: item.name,
			description: item.description?.substring(0, 100) + "...",
			value: `item_${item._id}`,
			emoji: `${index + 1}️⃣`,
		}));

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`search_select_${searchTerm}_${pageNum}`)
			.setPlaceholder(`Select an item${searchTerm ? ` (Search: ${searchTerm})` : ""}...`)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(options);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const embed = new EmbedBuilder()
			.setTitle("Search Results")
			.setDescription(searchTerm ? `Results for "${searchTerm}"` : "All items")
			.setColor("#00ff00");

		await interaction.reply({ embeds: [embed], components: [row] });
	} catch (error) {
		this.logger.error("Search select menu error:", error);
		await interaction.reply({
			content: "An error occurred while searching!",
			ephemeral: true,
		});
	}
};
```

## Select Menu with Categories

### Category Select Menu

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;
	const db = this.db;

	// Parse custom ID for category
	const [action, category] = customId.split("_");

	try {
		// Get items by category
		const items = await db.ZiItem.find({ category })
			.limit(25) // Discord limit
			.sort({ name: 1 });

		if (items.length === 0) {
			return await interaction.reply({
				content: `No items found in category: ${category}`,
				ephemeral: true,
			});
		}

		// Create select menu options
		const options = items.map((item, index) => ({
			label: item.name,
			description: item.description?.substring(0, 100) + "...",
			value: `item_${item._id}`,
			emoji: getCategoryEmoji(category),
		}));

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`category_select_${category}`)
			.setPlaceholder(`Select an item from ${category}...`)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(options);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const embed = new EmbedBuilder()
			.setTitle(`${category} Items`)
			.setDescription(`Choose an item from the ${category} category`)
			.setColor(getCategoryColor(category));

		await interaction.reply({ embeds: [embed], components: [row] });
	} catch (error) {
		this.logger.error("Category select menu error:", error);
		await interaction.reply({
			content: "An error occurred while loading category items!",
			ephemeral: true,
		});
	}
};

function getCategoryEmoji(category) {
	const emojis = {
		weapons: "⚔️",
		armor: "🛡️",
		potions: "🧪",
		misc: "📦",
	};
	return emojis[category] || "📦";
}

function getCategoryColor(category) {
	const colors = {
		weapons: "#ff0000",
		armor: "#0000ff",
		potions: "#00ff00",
		misc: "#ffff00",
	};
	return colors[category] || "#00ff00";
}
```

## Select Menu with Confirmation

### Confirmation Select Menu

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	const selectedValues = interaction.values;
	const customId = interaction.customId;

	// Parse custom ID for context
	const [action, targetId] = customId.split("_");

	if (selectedValues.includes("confirm")) {
		// User confirmed the action
		await handleConfirmation(interaction, action, targetId);
	} else if (selectedValues.includes("cancel")) {
		// User cancelled the action
		await handleCancellation(interaction);
	}
};

async function handleConfirmation(interaction, action, targetId) {
	const db = this.db;

	try {
		switch (action) {
			case "delete":
				await db.ZiItem.findByIdAndDelete(targetId);
				await interaction.reply({
					content: "Item deleted successfully!",
					ephemeral: true,
				});
				break;

			case "update":
				// Handle update logic
				await interaction.reply({
					content: "Item updated successfully!",
					ephemeral: true,
				});
				break;
		}

		this.logger.info(`Action ${action} confirmed by ${interaction.user.username}`);
	} catch (error) {
		this.logger.error("Confirmation error:", error);
		await interaction.reply({
			content: "An error occurred while processing your request!",
			ephemeral: true,
		});
	}
}

async function handleCancellation(interaction) {
	await interaction.reply({
		content: "Action cancelled.",
		ephemeral: true,
	});
}
```

## Best Practices

### 1. Use Descriptive Custom IDs

```javascript
// Good
.setCustomId("user_profile_select_123456789")

// Bad
.setCustomId("select1")
```

### 2. Limit Options to 25 (Discord Limit)

```javascript
const options = items.slice(0, 25); // Discord limit
```

### 3. Use Appropriate Emojis

```javascript
.addOptions([
    {
        label: "Option 1",
        value: "option1",
        emoji: "1️⃣", // Use number emojis for lists
    },
    {
        label: "Option 2",
        value: "option2",
        emoji: "2️⃣",
    },
]);
```

### 4. Handle Empty Results

```javascript
if (items.length === 0) {
	return await interaction.reply({
		content: "No items found!",
		ephemeral: true,
	});
}
```

### 5. Use Ephemeral Responses for Sensitive Data

```javascript
await interaction.reply({
	content: "Selection processed!",
	ephemeral: true,
});
```

### 6. Log Important Actions

```javascript
this.logger.info(`Select menu ${this.name} used by ${interaction.user.username}: ${selectedValues.join(", ")}`);
```

## File Organization

### Select Menus Directory Structure

```
functions/SelectMenu/
├── S_Help.js
├── S_user_list.js
├── S_item_list.js
├── S_category_list.js
└── S_admin_panel.js
```

## Testing Select Menus

### Local Testing

1. Create a command that shows a select menu
2. Select different options
3. Check the response
4. Test pagination and search

### Production Testing

1. Deploy the bot with new select menus
2. Test in a Discord server
3. Monitor logs for errors
4. Test edge cases and error conditions

## Troubleshooting

### Common Issues

1. **Select menu not responding**: Check if the select menu is registered in the functions collection
2. **Too many options**: Ensure you don't exceed Discord's 25 option limit
3. **Database errors**: Check database connection and model definitions
4. **Timeout errors**: Ensure select menus are handled within Discord's timeout limits

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different option selections

---

**This guide covers the basics of creating select menus with the App Class System. For more advanced features, refer to the
specific documentation for each service.**
