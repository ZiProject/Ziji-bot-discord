const { EmbedBuilder } = require("discord.js");
const { useClient, useLogger } = require("@zibot/zihooks");

module.exports = {
    name: "connectionError",
    type: "Player",
    /**
     *
     * @param {import('ziplayer').Player} player
     * @param {Error} error
     */
    execute: async (player, error) => {
        // Log for diagnostics
        try {
            const client = useClient();
            client?.errorLog?.("**Player connectionError**");
            client?.errorLog?.(error?.message || String(error));
        } catch {}
        try {
            useLogger().error(error);
        } catch {}

        // Lightweight user feedback in the channel (auto-delete)
        try {
            const embed = new EmbedBuilder()
                .setDescription(`:warning: Connection error: ${error?.message || "Unknown error"}`)
                .setColor("Red")
                .setTimestamp();

            const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
            setTimeout(() => replied?.delete().catch(() => {}), 5000);
        } catch {}
    },
};
