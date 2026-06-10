'use strict';

/**
 * noitu.js — /noitu slash command
 *
 * Sub-commands:
 *  • set-channel <channel> — designate a text channel for the word-chain game.
 *  • start                 — manually start a new word-chain session.
 *  • disable               — turn off the game, reset the session, send an end
 *    announcement to the channel.
 */

const { MessageFlags, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { useHooks } = require('zihooks');
const fs = require('fs');
const path = require('path');
const { resetGameState } = require('../../utility/wordGameUtils');

module.exports.data = {
    name: 'noitu',
    description: 'Trò chơi nối từ',
    type: 1, // slash command
    integration_types: [0],
    contexts: [0],
    options: [
        {
            name: 'set-channel',
            description: 'Đặt kênh chơi nối từ',
            type: 1,
            options: [
                {
                    name: 'channel',
                    description: 'Kênh cần đặt',
                    type: 7,
                    channel_types: [0], // GUILD_TEXT only
                    required: true,
                },
            ],
        },
        {
            name: 'start',
            description: 'Bắt đầu một phiên chơi nối từ mới',
            type: 1,
        },
        {
            name: 'disable',
            description: 'Tắt trò chơi nối từ',
            type: 1,
        },
    ],
};

/**
 * @param { object } command - object command
 * @param { import('discord.js').CommandInteraction } command.interaction
 * @param { import('../../lang/vi.js') } command.lang
 */
module.exports.execute = async ({ interaction }) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options?.getSubcommand();
    const guildId = interaction.guildId;

    // Ensure wordgame.json exists
    const wordpath = path.resolve(__dirname, '../../jsons/wordgame.json');
    if (!fs.existsSync(wordpath)) {
        useHooks.get('logger')?.debug('[wordgame] Creating word data...');
        fs.writeFileSync(wordpath, JSON.stringify({}));
    }

    const DataBase = useHooks.get('db');
    if (!DataBase) {
        return interaction.editReply({ content: '❌ Database hiện không khả dụng, vui lòng thử lại sau.' });
    }

    // ── set-channel ────────────────────────────────────────────────────────
    if (subcommand === 'set-channel') {
        const target = interaction.options.getChannel('channel');

        // Permission checks
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply({ content: '❌ Bạn không có quyền thực thi lệnh này!' });
        }
        if (!target.isTextBased()) {
            return interaction.editReply({ content: '❌ Kênh được chọn không phải là kênh văn bản.' });
        }
        if (!interaction.guild.members.me.permissionsIn(target).has(PermissionsBitField.Flags.ViewChannel)) {
            return interaction.editReply({ content: '❌ Tôi không có quyền xem kênh này!' });
        }
        if (!interaction.guild.members.me.permissionsIn(target).has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.editReply({ content: '❌ Tôi không có quyền gửi tin nhắn ở kênh này!' });
        }
        if (!interaction.guild.members.me.permissionsIn(target).has(PermissionsBitField.Flags.AddReactions)) {
            return interaction.editReply({ content: '❌ Tôi không có quyền thả cảm xúc ở kênh này!' });
        }

        // Update database
        let GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
        if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId });
        if (!GuildSetting.noitu) GuildSetting.noitu = {};
        GuildSetting.noitu.enabled = true;
        GuildSetting.noitu.channel = target.id;
        if (typeof GuildSetting.markModified === 'function') GuildSetting.markModified('noitu');
        await GuildSetting.save();

        // Invalidate config cache so the event handler picks up the new channel
        useHooks.get('temp')?.set(`noitu_${guildId}`, { enabled: true, channel: target.id });

        return interaction.editReply({ content: `✅ Kênh nối từ đã được đặt tại <#${target.id}>. Sử dụng lệnh \`/noitu start\` tại đây để bắt đầu trò chơi.` });
    }

    // ── start ──────────────────────────────────────────────────────────────
    if (subcommand === 'start') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply({ content: '❌ Bạn không có quyền thực thi lệnh này!' });
        }

        const GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
        if (!GuildSetting?.noitu?.enabled || !GuildSetting.noitu.channel) {
            return interaction.editReply({ content: '⚠️ Bạn chưa thiết lập kênh chơi nối từ. Hãy dùng lệnh `/noitu set-channel` trước.' });
        }

        const channelId = GuildSetting.noitu.channel;
        const target = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!target) {
            return interaction.editReply({ content: '❌ Không thể tìm thấy kênh đã thiết lập. Vui lòng thiết lập lại.' });
        }

        // Reset session data (fresh start)
        resetGameState(guildId);

        // Announce in the configured channel
        const startEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎮 Nối Từ — Bắt Đầu!')
            .setDescription(
                '**Luật chơi:**\n' +
                '• Gõ một từ **2 âm tiết** hợp lệ trong tiếng Việt\n' +
                '• Âm tiết đầu tiên của từ bạn gõ phải **khớp với âm tiết cuối** của từ trước\n' +
                '• Không được lặp lại từ đã dùng trong phiên này\n' +
                '• Không được đi **2 lần liên tiếp**\n\n' +
                '💡 Hãy bắt đầu bằng bất kỳ từ 2 âm tiết nào!',
            )
            .setFooter({ text: 'Phiên chơi mới đã được khởi tạo bởi Quản trị viên' })
            .setTimestamp();

        await target.send({ embeds: [startEmbed] }).catch(() => {});
        return interaction.editReply({ content: `✅ Đã bắt đầu phiên chơi nối từ mới tại <#${target.id}>` });
    }

    // ── disable ────────────────────────────────────────────────────────────
    if (subcommand === 'disable') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply({ content: '❌ Bạn không có quyền thực thi lệnh này!' });
        }

        const GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
        if (!GuildSetting?.noitu?.enabled) {
            return interaction.editReply({ content: '⚠️ Trò chơi nối từ hiện không được bật.' });
        }

        const channelId = GuildSetting.noitu.channel;

        // Update database
        GuildSetting.noitu.enabled = false;
        if (typeof GuildSetting.markModified === 'function') GuildSetting.markModified('noitu');
        await GuildSetting.save();

        // Invalidate config cache
        useHooks.get('temp')?.set(`noitu_${guildId}`, { enabled: false, channel: null });

        // Reset session
        resetGameState(guildId);

        // Announce in the game channel (if still accessible)
        if (channelId) {
            const gameChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (gameChannel) {
                const endEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('🛑 Nối Từ — Kết Thúc')
                    .setDescription('Trò chơi nối từ đã được tắt bởi quản trị viên. Phiên chơi đã được xóa.')
                    .setTimestamp();
                await gameChannel.send({ embeds: [endEmbed] }).catch(() => {});
            }
        }

        return interaction.editReply({ content: '✅ Trò chơi nối từ đã được tắt.' });
    }
};