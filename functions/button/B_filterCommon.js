const { useCommands } = require("@zibot/zihooks");

module.exports.data = {
        name: "B_filterCommon",
        type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
        // Tạo một đối tượng tương tác mới với bộ lọc common
        const newInteraction = {
                ...interaction,
                options: {
                        getUser: () => null,
                        getString: (key) => key === "rarity" ? "common" : null
                }
        };
        
        const Command = useCommands();
        return Command.get("zoo").execute({ interaction: newInteraction, lang });
};