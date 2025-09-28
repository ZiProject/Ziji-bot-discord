# Ziji Bot Discord - Documentation

Welcome to the Ziji Bot Discord documentation! This guide will help you understand and use the App Class System to create
commands, buttons, modals, select menus, and events.

## 📚 Documentation Index

### Core System

- [**App Class System**](./APP_CLASS_SYSTEM.md) - Complete overview of the App Class System
- [**Migration Guide**](./MIGRATION_COMPLETE.md) - Migration from @zibot/zihooks to App Class System

### Creating Components

- [**Creating Commands**](./CREATING_COMMANDS.md) - How to create slash commands, context menus, and more
- [**Creating Buttons**](./CREATING_BUTTONS.md) - How to create interactive buttons
- [**Creating Modals**](./CREATING_MODALS.md) - How to create popup forms for user input
- [**Creating Select Menus**](./CREATING_SELECT_MENUS.md) - How to create dropdown menus
- [**Creating Events**](./CREATING_EVENTS.md) - How to create event handlers

## 🚀 Quick Start

### 1. Understanding the App Class System

The App Class System provides centralized access to all bot services through a single `this` context:

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	// Access all services through this
	const client = this.client; // Discord client
	const config = this.config; // Bot configuration
	const db = this.db; // Database
	const logger = this.logger; // Logger
	const manager = this.manager; // Player manager
	// ... and more
};
```

### 2. Creating Your First Command

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
	name: "hello",
	description: "Say hello to the bot",
	type: 1, // Slash command
};

/**
 * @param {Object} command - Command object
 * @param {import("discord.js").CommandInteraction} command.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} command.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	const embed = new EmbedBuilder().setTitle("Hello!").setDescription(`Hello, ${interaction.user.username}!`).setColor("#00ff00");

	await interaction.reply({ embeds: [embed] });
};
```

### 3. Creating Your First Button

```javascript
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
	name: "hello_button",
	description: "A hello button",
	type: "button",
};

/**
 * @param {Object} button - Button object
 * @param {import("discord.js").ButtonInteraction} button.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} button.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	const embed = new EmbedBuilder()
		.setTitle("Button Clicked!")
		.setDescription("You clicked the hello button!")
		.setColor("#00ff00");

	await interaction.reply({ embeds: [embed], ephemeral: true });
};
```

## 🎯 Available Services

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

## 📁 File Organization

### Commands

```
commands/
├── config/          # Configuration commands
├── fun/             # Fun commands
├── games/           # Game commands
├── moderation/      # Moderation commands
├── music/           # Music commands
├── owner/           # Owner-only commands
└── utility/         # Utility commands
```

### Functions

```
functions/
├── button/          # Button interactions
├── modal/           # Modal interactions
├── SelectMenu/      # Select menu interactions
└── utils/           # Utility functions
```

### Events

```
events/
├── client/          # Discord client events
├── player/          # Music player events
├── process/         # Process events
└── console/         # Console events
```

## 🔧 Development Setup

### 1. Prerequisites

- Node.js 16+
- Discord Bot Token
- MongoDB (optional, can use local JSON)

### 2. Installation

```bash
npm install
```

### 3. Configuration

1. Copy `config.js.example` to `config.js`
2. Fill in your bot token and configuration
3. Set up your database (MongoDB or local JSON)

### 4. Running the Bot

```bash
# Development
npm run dev

# Production
npm start
```

## 📖 Type Safety

### JSDoc Support

All files include comprehensive JSDoc documentation for type safety:

```javascript
/**
 * @param {Object} command - Command object
 * @param {import("discord.js").CommandInteraction} command.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} command.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// this.client, this.config, this.db, etc. are all typed
};
```

### IDE Support

- **IntelliSense** - Full autocomplete support
- **Go to Definition** - Jump to type definitions
- **Hover Information** - See type information on hover
- **Error Detection** - Catch type errors before runtime

## 🚀 Best Practices

### 1. Always Use Try-Catch

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	try {
		// Your logic
	} catch (error) {
		this.logger.error("Error:", error);
		await interaction.reply({
			content: "An error occurred!",
			ephemeral: true,
		});
	}
};
```

### 2. Check Service Availability

```javascript
if (!this.db) {
	return await interaction.reply({
		content: "Database not available!",
		ephemeral: true,
	});
}
```

### 3. Use Appropriate Logging

```javascript
this.logger.debug("Debug information");
this.logger.info("Important information");
this.logger.error("Error occurred:", error);
```

### 4. Handle Errors Gracefully

```javascript
try {
	const user = await this.db.ZiUser.findOne({ userId: interaction.user.id });
	if (!user) {
		return await interaction.reply({
			content: "User not found!",
			ephemeral: true,
		});
	}
} catch (error) {
	this.logger.error("Database error:", error);
	await interaction.reply({
		content: "Database error occurred!",
		ephemeral: true,
	});
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Service not available**: Check if the service is properly initialized
2. **Type errors**: Ensure JSDoc types are correct
3. **Permission errors**: Verify bot has required permissions
4. **Database errors**: Check database connection and model definitions

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check the console for error messages
3. Verify all required services are available
4. Test with different user permissions

## 📞 Support

If you need help or have questions:

1. **Check the documentation** - Most questions are answered in the guides
2. **Look at examples** - Check existing commands and functions
3. **Check logs** - Look for error messages in the console
4. **Test locally** - Use development mode for testing

## 🎉 Conclusion

The App Class System provides a modern, type-safe, and efficient way to develop Discord bots. With centralized service access,
comprehensive type safety, and excellent developer experience, you can build powerful and maintainable bots.

### Key Features:

- ✅ **Centralized access** to all services
- ✅ **Type safety** with JSDoc and TypeScript
- ✅ **Performance optimization** with direct property access
- ✅ **Developer experience** with IntelliSense and autocomplete
- ✅ **Maintainability** with clear dependencies and structure

### Next Steps:

1. **Read the specific guides** for the components you want to create
2. **Follow the examples** to understand the patterns
3. **Start building** your own commands and functions
4. **Test thoroughly** before deploying to production

---

**Happy coding! 🚀**
