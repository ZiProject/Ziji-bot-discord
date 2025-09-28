# App Class System - Complete Guide

## Overview

The App Class System is a centralized architecture for Ziji Bot Discord that provides access to all bot services through a single
`this` context. This system replaces the need for individual hook imports and provides a clean, type-safe way to access bot
functionality.

## Architecture

### Core Components

```
core/
├── App.js              # Main App class
└── AppManager.js       # Singleton manager

startup/
├── loader.js           # File loader with App binding
└── index.js            # Startup manager

index.js                # Main entry point
```

### App Class Structure

```javascript
class App {
	constructor(options) {
		// Core services
		this.client = null;
		this.config = options.config;
		this.logger = options.logger;

		// Collections
		this.cooldowns = new Collection();
		this.commands = new Collection();
		this.functions = new Collection();
		this.responder = new Collection();
		this.welcome = new Collection();

		// Specialized services
		this.giveaways = null;
		this.manager = null;
		this.db = null;
	}
}
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

## Usage Examples

### Commands

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	// Access all services through this
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	// Use services
	const user = await db.ZiUser.findOne({ userId: interaction.user.id });
	logger.info(`Command used by ${interaction.user.username}`);
};
```

### Functions

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	// Access all services through this
	const client = this.client;
	const manager = this.manager;
	const config = this.config;

	// Use services
	const player = manager.get(interaction.guild.id);
	if (player) {
		// Do something with player
	}
};
```

### Events

```javascript
module.exports.execute = async function (client) {
	// Access all services through this
	const logger = this.logger;
	const config = this.config;

	// Use services
	logger.info(`Bot ready: ${client.user.tag}`);
};
```

## Type Safety

### JSDoc Support

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

### TypeScript Support

```typescript
// types/global.d.ts
declare global {
	interface ModuleContext {
		app: App;
		client: Client;
		cooldowns: Collection;
		commands: Collection;
		functions: Collection;
		responder: Collection;
		welcome: Collection;
		giveaways: GiveawaysManager | Function;
		manager: PlayerManager;
		config: Object;
		logger: Object;
		db: Object;
	}
}
```

## Benefits

### 1. Centralized Access

- All services available through `this`
- No need to import individual hooks
- Consistent API across all files

### 2. Type Safety

- Full JSDoc support
- IDE autocomplete
- Type checking at compile time

### 3. Performance

- No hook function calls
- Direct property access
- Optimized memory usage

### 4. Maintainability

- Single source of truth
- Easy to refactor
- Clear dependencies

### 5. Developer Experience

- IntelliSense support
- Go to definition
- Hover information

## Migration from @zibot/zihooks

### Before (Old System)

```javascript
const { useClient, useConfig, useDB, useLogger } = require("@zibot/zihooks");

module.exports.execute = async function ({ interaction, lang }) {
	const client = useClient();
	const config = useConfig();
	const db = useDB();
	const logger = useLogger();

	// Use services
	const user = await db.ZiUser.findOne({ userId: interaction.user.id });
	logger.info("Command used");
};
```

### After (App Class System)

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	// Access all services through this
	const client = this.client;
	const config = this.config;
	const db = this.db;
	const logger = this.logger;

	// Use services
	const user = await db.ZiUser.findOne({ userId: interaction.user.id });
	logger.info("Command used");
};
```

## Configuration

### App Initialization

```javascript
const { appManager } = require("./core/AppManager");

// Initialize app
const app = appManager.initialize({
	config,
	logger: console,
	enableGiveaways: config.DevConfig?.Giveaway,
	giveawayStorage: "./jsons/giveaways.json",
});

// Initialize with client
await app.initialize(client);
```

### Service Configuration

```javascript
// Database
this.db = {
	ZiUser: createModel(db, "ZiUser"),
	ZiAutoresponder: createModel(db, "ZiAutoresponder"),
	ZiWelcome: createModel(db, "ZiWelcome"),
	ZiGuild: createModel(db, "ZiGuild"),
};

// Player Manager
this.manager = new PlayerManager({
	plugins: [new TTSPlugin(), new YTSRPlugin()],
	extensions: [new lyricsExt(), new voiceExt()],
});

// Giveaways
this.giveaways = new GiveawaysManager(this.client, {
	storage: "./jsons/giveaways.json",
	default: {
		botsCanWin: false,
		embedColor: "Random",
		reaction: "🎉",
	},
});
```

## Error Handling

### Global Error Handling

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

### Service Availability Check

```javascript
module.exports.execute = async function ({ interaction, lang }) {
	// Check if services are available
	if (!this.db || !this.db.ZiUser) {
		return await interaction.reply({
			content: "Database not available!",
			ephemeral: true,
		});
	}

	// Use services
	const user = await this.db.ZiUser.findOne({ userId: interaction.user.id });
};
```

## Best Practices

### 1. Always Check Service Availability

```javascript
if (!this.db) {
	this.logger.error("Database not available");
	return;
}
```

### 2. Use Appropriate Logging

```javascript
this.logger.debug("Debug information");
this.logger.info("Important information");
this.logger.error("Error occurred:", error);
```

### 3. Handle Errors Gracefully

```javascript
try {
	// Your logic
} catch (error) {
	this.logger.error("Error:", error);
	// Handle error appropriately
}
```

### 4. Use Type Safety

```javascript
/**
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	// this.client, this.config, etc. are all typed
};
```

### 5. Optimize Performance

```javascript
// Good - direct access
const user = await this.db.ZiUser.findOne({ userId: interaction.user.id });

// Bad - unnecessary function calls
const db = this.getDB();
const user = await db.ZiUser.findOne({ userId: interaction.user.id });
```

## Troubleshooting

### Common Issues

1. **Service not available**: Check if the service is properly initialized
2. **Type errors**: Ensure JSDoc types are correct
3. **Performance issues**: Use direct property access instead of function calls
4. **Memory leaks**: Ensure proper cleanup in long-running operations

### Debug Tips

1. Use `this.logger.debug()` for detailed logging
2. Check service availability before use
3. Verify all required services are initialized
4. Test with different configurations

## File Structure

### Complete File Structure

```
Ziji-bot-discord/
├── core/
│   ├── App.js              # Main App class
│   └── AppManager.js       # Singleton manager
├── startup/
│   ├── loader.js           # File loader
│   └── index.js            # Startup manager
├── commands/
│   ├── config/
│   ├── fun/
│   ├── games/
│   ├── moderation/
│   ├── music/
│   ├── owner/
│   └── utility/
├── functions/
│   ├── button/
│   ├── modal/
│   ├── SelectMenu/
│   └── utils/
├── events/
│   ├── client/
│   ├── player/
│   ├── process/
│   └── console/
├── types/
│   └── global.d.ts         # Type definitions
├── docs/
│   ├── CREATING_COMMANDS.md
│   ├── CREATING_BUTTONS.md
│   ├── CREATING_MODALS.md
│   ├── CREATING_SELECT_MENUS.md
│   ├── CREATING_EVENTS.md
│   └── APP_CLASS_SYSTEM.md
└── index.js                # Main entry point
```

## Conclusion

The App Class System provides a modern, type-safe, and efficient way to manage bot services. It eliminates the need for individual
hook imports and provides a clean, consistent API for accessing all bot functionality.

### Key Benefits:

- ✅ **Centralized access** to all services
- ✅ **Type safety** with JSDoc and TypeScript
- ✅ **Performance optimization** with direct property access
- ✅ **Developer experience** with IntelliSense and autocomplete
- ✅ **Maintainability** with clear dependencies and structure

### Next Steps:

1. **Read the specific guides** for commands, buttons, modals, select menus, and events
2. **Follow the examples** to create your own components
3. **Use the type definitions** for better IDE support
4. **Test thoroughly** before deploying to production

---

**This guide provides a complete overview of the App Class System. For specific implementation details, refer to the individual
guides for each component type.**
