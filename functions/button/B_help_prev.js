const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useLang } = require("@zibot/zihooks");
const SHelpModule = require("../SelectMenu/S_Help.js");

module.exports.data = {
        name: "B_help_prev",
        type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
        const footerText = interaction.message?.embeds?.[0]?.footer?.text;
        
        if (!footerText || !footerText.includes('SHELP|')) {
                return await interaction.reply({
                        content: lang.Help.UserOnlyMessage || "Only the user who requested this help menu can use these buttons.",
                        ephemeral: true
                });
        }
        
        const match = footerText.match(/SHELP\|([^|]+)\|(\d+)\/(\d+)\|uid=(\d+)/);
        if (!match) {
                return await interaction.reply({
                        content: lang.Help.UserOnlyMessage || "Invalid help menu state.",
                        ephemeral: true
                });
        }
        
        const [, category, currentPageStr, totalPagesStr, userId] = match;
        const currentPage = parseInt(currentPageStr);
        const totalPages = parseInt(totalPagesStr);
        
        if (userId !== interaction.user.id) {
                return await interaction.reply({
                        content: lang.Help.UserOnlyMessage || "Only the user who requested this help menu can use these buttons.",
                        ephemeral: true
                });
        }
        
        if (currentPage <= 1) {
                return await interaction.reply({
                        content: lang.Help.FirstPage || "You are already on the first page.",
                        ephemeral: true
                });
        }
        
        const newPage = currentPage - 1;
        
        try {
                const commands = await SHelpModule.commands(interaction);
                let result;
                
                if (category === 'gc') {
                        result = SHelpModule.paginateCommands(commands.guildCommands, newPage, lang, 'guild_commands', interaction.user.id);
                } else if (category === 'cc') {
                        result = SHelpModule.paginateContextCommands(commands.contextCommands, newPage, lang, interaction.user.id);
                } else {
                        return await interaction.reply({
                                content: "Invalid category.",
                                ephemeral: true
                        });
                }
                
                const embed = new EmbedBuilder()
                        .setAuthor({
                                name: `${interaction.client.user.username} Help:`,
                                iconURL: interaction.client.user.displayAvatarURL({ size: 1024 }),
                        })
                        .setDescription(result.description)
                        .setColor(lang?.color || "Random")
                        .setFooter(result.footer)
                        .setTimestamp();
                
                // Always preserve the original select menu and support buttons
                const originalComponents = SHelpModule.buildOriginalComponents(lang);
                const allComponents = [...originalComponents];
                if (result.components.length > 0) {
                        allComponents.push(...result.components);
                }
                
                const updateOptions = { embeds: [embed], components: allComponents };
                
                await interaction.update(updateOptions);
        } catch (error) {
                console.error('Error in B_help_prev:', error);
                await interaction.reply({
                        content: "An error occurred while navigating to the previous page.",
                        ephemeral: true
                });
        }
};