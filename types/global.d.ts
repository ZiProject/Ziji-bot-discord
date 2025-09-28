/**
 * Global type definitions for Ziji Bot Discord
 * @fileoverview Global type definitions for App Class System
 */

import { Client, Collection, EmbedBuilder } from "discord.js";
import { GiveawaysManager } from "discord-giveaways";
import { PlayerManager } from "ziplayer";

/**
 * @typedef {Object} ModuleContext
 * @property {import("../core/App").App} app - App instance
 * @property {Client} client - Discord client instance
 * @property {Collection} cooldowns - Cooldowns collection
 * @property {Collection} commands - Commands collection
 * @property {Collection} functions - Functions collection
 * @property {Collection} responder - Responder collection
 * @property {Collection} welcome - Welcome collection
 * @property {GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

/**
 * @typedef {Object} CommandContext
 * @property {import("discord.js").CommandInteraction} interaction - Discord interaction
 * @property {import("../lang/vi.js")} lang - Language object
 * @property {Object} [player] - Player instance (for music commands)
 * @property {Object} [status] - Status object (for music commands)
 */

/**
 * @typedef {Object} FunctionContext
 * @property {import("discord.js").ButtonInteraction|import("discord.js").ModalSubmitInteraction|import("discord.js").SelectMenuInteraction} interaction - Discord interaction
 * @property {import("../lang/vi.js")} lang - Language object
 * @property {Object} [player] - Player instance (for music functions)
 * @property {Object} [status] - Status object (for music functions)
 */

/**
 * @typedef {Object} EventContext
 * @property {Client} client - Discord client
 * @property {Object} [args] - Additional arguments
 */

/**
 * @typedef {Object} DatabaseModels
 * @property {Object} ZiUser - User model
 * @property {Object} ZiAutoresponder - Autoresponder model
 * @property {Object} ZiWelcome - Welcome model
 * @property {Object} ZiGuild - Guild model
 */

/**
 * @typedef {Object} BotConfig
 * @property {string} [defaultColor] - Default embed color
 * @property {Object} [botConfig] - Bot configuration
 * @property {Array<string>} [OwnerID] - Bot owner IDs
 * @property {number} [defaultCooldownDuration] - Default cooldown duration
 * @property {Object} [DevConfig] - Developer configuration
 * @property {boolean} [deploy] - Deploy commands flag
 */

/**
 * @typedef {Object} Logger
 * @property {Function} info - Info log function
 * @property {Function} error - Error log function
 * @property {Function} warn - Warning log function
 * @property {Function} debug - Debug log function
 */

// Global declarations
declare global {
    /**
     * @typedef {Object} ModuleContext
     */
}

export {};