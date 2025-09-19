const { useCommands } = require("@zibot/zihooks");

module.exports.data = {
        name: "B_filterAll",
        type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
        // Tạo một đối tượng tương tác mới không có bộ lọc độ hiếm
        const newInteraction = {
                ...interaction,
                options: {
                        getUser: () => null,
                        getString: () => null
                }
        };
        
        const Command = useCommands();
        return Command.get("zoo").execute({ interaction: newInteraction, lang });
};