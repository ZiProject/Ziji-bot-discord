const { AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const path = require("path");
const fs = require("fs");

module.exports.data = {
    name: "B_ticket_close",
    type: "button",
};

/**
 * Parser Markdown chuyên sâu cho Discord
 */
function parseDiscordMarkdown(content, guild) {
    if (!content) return '';
    
    let html = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 1. Timestamps <t:12345678:R>
    const formatTs = (ts, style = 'f') => {
        const date = new Date(Number(ts) * 1000);
        if (isNaN(date)) return `<span class="text-gray-500">&lt;t:${ts}&gt;</span>`;
        
        const options = {
            t: { hour: '2-digit', minute: '2-digit' },
            T: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
            d: { day: '2-digit', month: '2-digit', year: 'numeric' },
            D: { day: 'numeric', month: 'long', year: 'numeric' },
            f: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
            F: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
            R: 'relative'
        };

        if (style === 'R') {
            const diff = Math.round((date - Date.now()) / 1000);
            const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
            if (Math.abs(diff) < 60) return rtf.format(diff, 'second');
            if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
            if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
            return rtf.format(Math.round(diff / 86400), 'day');
        }
        return date.toLocaleString('vi-VN', options[style] || options.f);
    };

    html = html.replace(/&lt;t:(\d+):?([tTdDfFR])?&gt;/g, (m, ts, s) => 
        `<span class="bg-[#3b4044] px-1 rounded text-[#dbdee1] cursor-help" title="${new Date(ts * 1000).toLocaleString()}">${formatTs(ts, s)}</span>`
    );

    // 2. Mentions (@user, @role, #channel)
    html = html.replace(/&lt;@!?(\d+)&gt;/g, (m, id) => {
        const mem = guild.members.cache.get(id);
        return `<span class="mention user">@${mem ? mem.displayName : id}</span>`;
    });
    html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (m, id) => {
        const role = guild.roles.cache.get(id);
        const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#5865f2';
        return `<span class="mention" style="color: ${color}; background: ${color}1A">@${role ? role.name : id}</span>`;
    });
    html = html.replace(/&lt;#(\d+)&gt;/g, (m, id) => {
        const chan = guild.channels.cache.get(id);
        return `<span class="mention channel">#${chan ? chan.name : id}</span>`;
    });

    // 3. Basic Markdown
    html = html.replace(/```(?:(\w+)\n)?([\s\S]+?)```/g, '<pre class="code-block"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([\s\S]+?)__/g, '<u>$1</u>');
    html = html.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
    html = html.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    
    // 4. Links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="link">$1</a>');
    html = html.replace(/(?<!href=")(?<!">)https?:\/\/[^\s<)]+/g, (m) => `<a href="${m}" target="_blank" class="link">${m}</a>`);


    return html.replace(/\n/g, '<br>');
}

module.exports.execute = async ({ interaction, lang }) => {
    await interaction.deferReply();
    const channel = interaction.channel;
    const DataBase = useHooks.get("db");
    let GuildSetting = await DataBase.ZiGuild.findOne({ guildId: interaction.guild.id });
    if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId: interaction.guild.id });
    if (!GuildSetting.ticket) return interaction.editReply({ content: "❌ Ticket system chưa được thiết lập!" });
    if (!GuildSetting.ticket.allowUserClose) {
    if (!interaction.member.permissions.has("ManageChannels")) return interaction.editReply({ content: "❌ Bạn không có quyền đóng ticket này!" });
    }
    const categoryId = GuildSetting.ticket.categoryId;

    const staffRoleId = GuildSetting.ticket.staffRoleId;
    const memberIdTarget = channel.permissionOverwrites.cache.find(p => p.type === 1 && p.id !== interaction.guild.roles.everyone.id && p.id !== staffRoleId)?.id;
    let ticketCreator = null;
    if (memberIdTarget) {
    try { ticketCreator = await interaction.guild.members.fetch(memberIdTarget); } catch {}
    }
    const client = useHooks.get("client");
    await interaction.editReply('⏳ Đang thu thập tin nhắn và khởi tạo bản sao Transcript...');
    const messages = await channel.messages.fetch({ limit: 100 });
    const messageArray = Array.from(messages.values()).reverse();
    const guild = interaction.guild;
    const template = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transcript #${channel.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-main: #313338;
                --bg-secondary: #2b2d31;
                --bg-header: #1e1f22;
                --text-main: #dbdee1;
                --text-muted: #949ba4;
                --discord-blue: #5865f2;
            }
            body { 
                background-color: var(--bg-main); 
                color: var(--text-main); 
                font-family: 'Quicksand', sans-serif; 
                line-height: 1.5;
            }
            .mention { 
                font-weight: 500; padding: 0 4px; border-radius: 3px; cursor: pointer; transition: 0.2s;
                background: rgba(88, 101, 242, 0.1); color: var(--discord-blue);
            }
            .mention.user:hover { background: var(--discord-blue); color: white; }
            .mention.channel { color: #949ba4; background: rgba(148, 155, 164, 0.1); }
            .mention.channel:hover { text-decoration: underline; background: rgba(148, 155, 164, 0.2); }
            
            .code-block { background: #1e1f22; border: 1px solid #111214; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 0.9em; }
            .inline-code { background: #232428; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em; }
            
            .spoiler { background: #1e1f22; color: transparent; border-radius: 3px; cursor: pointer; transition: 0.2s; padding: 0 2px; }
            .spoiler.revealed { color: inherit; background: rgba(255,255,255,0.1); }
            
            .link { color: #00a8fc; text-decoration: none; }
            .link:hover { text-decoration: underline; }
            
            .embed { border-left: 4px solid var(--discord-blue); background: var(--bg-secondary); padding: 12px; border-radius: 4px; margin-top: 8px; max-width: 520px; }
            
            .avatar { width: 40px; height: 40px; border-radius: 50%; transition: transform 0.2s; }
            .message-group:hover { background: rgba(0,0,0,0.02); }
            
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: var(--bg-main); }
            ::-webkit-scrollbar-thumb { background: #1a1b1e; border-radius: 10px; }
        </style>
    </head>
    <body class="py-10 px-4 md:px-0">
        <div class="max-w-3xl mx-auto">
            <!-- Header -->
            <header class="bg-[var(--bg-header)] rounded-t-2xl p-6 border-b border-[#232428] shadow-2xl">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-green-500 w-3 h-3 rounded-full animate-pulse"></span>
                            <h1 class="text-xl font-bold text-white tracking-tight">TRANSCRIPT TICKET</h1>
                        </div>
                        <p class="text-sm text-[var(--text-muted)]">Kênh: <span class="text-white font-mono">#${channel.name}</span></p>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-[var(--text-muted)] uppercase font-semibold">Ngày tạo bản sao</div>
                        <div class="text-sm text-white">${new Date().toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            </header>

            <!-- Main Chat -->
            <main class="bg-[var(--bg-secondary)] shadow-xl min-h-[500px]">
                <div class="py-6">
                ${messageArray.map(msg => {
                    if (msg.author.bot && msg.components.length > 0 && msg.interaction) return '';
                    const avatar = msg.author.displayAvatarURL({ size: 128 });
                    const time = new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const date = new Date(msg.createdAt).toLocaleDateString('vi-VN');

                    return `
                    <div class="flex gap-4 px-6 py-2 hover:bg-[#2e3035] transition-colors group message-group">
                        <img src="${avatar}" class="avatar mt-1" alt="avatar">
                        <div class="flex-1">
                            <div class="flex items-baseline gap-2">
                                <span class="font-semibold text-white hover:underline cursor-pointer">${msg.author.username}</span>
                                ${msg.author.bot ? '<span class="bg-[#5865f2] text-[10px] px-1.5 py-0.5 rounded text-white font-bold">BOT</span>' : ''}
                                <span class="text-xs text-[var(--text-muted)] font-medium">${date} lúc ${time}</span>
                            </div>
                            
                            <div class="text-[15px] text-[#dbdee1] break-words">
                                ${msg.content ? parseDiscordMarkdown(msg.content, guild) : ''}
                            </div>

                            ${msg.attachments.size > 0 ? `
                                <div class="mt-3 flex flex-wrap gap-2">
                                    ${Array.from(msg.attachments.values()).map(a => 
                                        a.contentType?.startsWith('image') 
                                        ? `<img src="${a.url}" class="rounded-lg max-w-full md:max-w-md border border-[#232428] shadow-sm hover:scale-[1.01] transition-transform">`
                                        : `<a href="${a.url}" class="flex items-center gap-2 p-3 bg-[var(--bg-main)] rounded border border-[#232428] text-sm text-blue-400">📁 ${a.name}</a>`
                                    ).join('')}
                                </div>
                            ` : ''}

                            ${msg.embeds.map(embed => `
                                <div class="embed" style="border-color: ${embed.hexColor || '#5865f2'}">
                                    ${embed.author ? `<div class="text-sm font-bold text-white mb-1">${embed.author.name}</div>` : ''}
                                    ${embed.title ? `<div class="font-bold text-white mb-1">${embed.title}</div>` : ''}
                                    ${embed.description ? `<div class="text-sm text-[#dbdee1]">${parseDiscordMarkdown(embed.description, guild)}</div>` : ''}
                                    ${embed.fields.length > 0 ? `
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            ${embed.fields.map(f => `
                                                <div>
                                                    <div class="text-xs font-bold text-white uppercase">${f.name}</div>
                                                    <div class="text-sm text-[#dbdee1]">${parseDiscordMarkdown(f.value, guild)}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                    ${embed.image ? `<img src="${embed.image.url}" class="mt-3 rounded-md max-w-full">` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
                }).join('')}
                </div>
            </main>

            <!-- Footer -->
            <footer class="bg-[var(--bg-header)] rounded-b-2xl p-4 text-center border-t border-[#232428]">
                <p class="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                    Hệ thống lưu trữ bảo mật • Transcript bởi <strong>${interaction.client.user.username}</strong>
                </p>
            </footer>
        </div>
    </body>
    </html>
    `;

    const buffer = Buffer.from(template, 'utf-8');
    // save to transcripts folder
    let dmSuccess = false;
    const fileName = `transcript-${channel.name}-${Math.random().toString(36).substring(2, 12)}.html`;
    if (process.env.API_URL) {
        const transcriptDir = path.join(__dirname, '../../transcripts');
        if (!fs.existsSync(transcriptDir)) {
            fs.mkdirSync(transcriptDir);
        }
        const filePath = path.join(transcriptDir, fileName);
        fs.writeFileSync(filePath, buffer);
        const url = `${process.env.API_URL}/transcripts/${fileName}`;
        try {
            const dmEmbed = {
                color: 0x5865f2,
                title: '🔒 Ticket Hỗ Trợ Đã Được Đóng',
                description: `Chào bạn, kênh hỗ trợ \`#${channel.name}\` tại server **${interaction.guild.name}** đã được giải quyết xong và đóng lại bởi Ban Quản Trị.\n\nDưới đây là link transcript lưu lại toàn bộ cuộc hội thoại của bạn. Bạn có thể mở bằng trình duyệtđể xem lại nhé!\n> ⚠️ Link chỉ tồn tại trong vòng 30 ngày kể từ ngày tạo!`,
                timestamp: new Date()
            };
            await ticketCreator.send({ embeds: [dmEmbed], components: [{ type: 1, components: [{ type: 2, label: '📂 Xem Transcript', style: 5, url }] }] });
            dmSuccess = true;
        } catch (err) {
            console.log(`Không thể DM gửi transcript cho ${ticketCreator.user.tag} do đóng DM cá nhân.`);
        }
    } else {
        // send file
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}-${Math.random().toString(36).substring(2, 12)}.html` });
        if (ticketCreator) {
            try {
                const dmEmbed = {
                    color: 0x5865f2,
                    title: '🔒 Ticket Hỗ Trợ Đã Được Đóng',
                    description: `Chào bạn, kênh hỗ trợ \`#${channel.name}\` tại server **${interaction.guild.name}** đã được giải quyết xong và đóng lại bởi Ban Quản Trị.\n\nDưới đây là file đính kèm lưu lại toàn bộ cuộc hội thoại của bạn. Bạn hãy tải về và mở bằng trình duyệt (Chrome, Edge, Cốc Cốc...) để xem lại giao diện nhé!`,
                    timestamp: new Date()
                };
                await ticketCreator.send({ embeds: [dmEmbed], files: [attachment] });
                dmSuccess = true;
            } catch (err) {
                console.log(`Không thể DM gửi transcript cho ${ticketCreator.user.tag} do đóng DM cá nhân.`);
            }
        }
    }
    await interaction.editReply({
        content: `✅ Hệ thống đã đóng và lưu bản sao thành công!${dmSuccess ? ' File transcript đã được gửi trực tiếp vào tin nhắn riêng (DM) của User.' : ' ⚠️ Không thể DM cho user (Do họ tắt nhận tin nhắn từ người lạ).'}\n Kênh này sẽ tự động biến mất sau **5 giây**.`
    });
    setTimeout(async () => {
        try {
            await channel.delete();
        } catch (err) {
            console.error('Lỗi khi xóa channel ticket:', err);
        }
    }, 5000);
    if (GuildSetting.ticket.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(GuildSetting.ticket.logChannelId);
        if (logChannel) {
            const logEmbed = {
                color: 0x5865f2,
                title: '📁 Ticket Đã Được Đóng',
                description: `Kênh <#${channel.id}> đã được đóng bởi ${interaction.user.tag}.\n\n${process.env.API_URL ? `Transcript đã được lưu và có thể truy cập tại [đây](${process.env.API_URL}/transcripts/${fileName})` : 'Transcript đã được lưu dưới dạng file đính kèm.'}`,
                timestamp: new Date()
            };  
            logChannel.send({ embeds: [logEmbed], attachments: process.env.API_URL ? [] : [new AttachmentBuilder(Buffer.from(template, 'utf-8'), { name: `transcript-${channel.name}-${Math.random().toString(36).substring(2, 12)}.html` })] });
        }
    }
}