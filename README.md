<div align="center">
  <img src="https://raw.githubusercontent.com/zijipia/zijipia/main/Assets/ZijiAvt.gif" width="80" alt="Ziji Bot"/>

  <h1>Zibot V10</h1>
  <p>A feature-rich Discord bot built with <a href="https://discord.js.org/">discord.js</a> and <a href="https://player.ziji.best">ziplayer</a></p>

  <a href="https://discord.com/oauth2/authorize?client_id=1501197759754272928">
    <img src="https://img.shields.io/badge/Add%20to%20Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Add Ziji Bot"/>
  </a>
  <a href="https://discord.gg/wbhBExpMNj">
    <img src="https://img.shields.io/discord/1007597270704869387?style=for-the-badge&color=7289DA&logo=discord&logoColor=white&label=Support" alt="Support Server"/>
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"/>
  </a>
</div>

---

## ✨ Features

### 🎵 Music Player

Full-featured music playback with an interactive player UI v2, queue management, search, and more. Multi bot support on one
player/per voice channel. Image search track support

<table>
<tr>
<td width="50%"><img width="985" height="916" alt="image" src="https://github.com/user-attachments/assets/60611cbb-08e1-4cf9-9fab-00805384d6e3" />
</td>
<td width="50%"><img alt="Search" src="https://github.com/zijipia/zijipia/blob/Ziji-Discord-Bot-Image/Assets/search.png"/></td>
</tr>
</table>

### 🎤 Voice Commands

- Control music via voice: play, pause, skip, volume, and more
- Multi-language recognition: **Vietnamese** & **English**
- Built-in **AI assistant** — talk to the AI directly in voice channels

### 📝 Lyrics

Powered by [Lrclib](https://lrclib.net) — supports both **synced** (real-time) and **plain** lyrics.

### 🎮 Mini-Games

2048 · Blackjack · Coinflip · Slots · Snake · Battle · Tic-Tac-Toe · Wheel · and more

### 🛡️ Moderation

Ban · Kick · Timeout · Purge · Auto-Responder · Giveaways · Ticket system · Welcomer · GuildCommand · join-to-create · youtube

<img width="930" height="280" alt="WelcomeCard" src="https://github.com/user-attachments/assets/07a639cf-bff6-48c2-9637-f6df4deda41a" />

<table>
<tr>
<td width="50%">
<img width="569" height="720" alt="image" src="https://github.com/user-attachments/assets/f4b04b30-0aca-4a0f-9f6c-5915b731526a" />
	
</td>
<td width="50%">
<img width="678" height="874" alt="image" src="https://github.com/user-attachments/assets/706ee7b7-105b-4041-80c6-8d9f1f753ccc" />

</td>
</tr>
</table>

### 🌐 Web Interface

| Web Control                                                                                                                         | Web Music Player                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Ziji-bot-web](https://github.com/zijipia/Zibot-Web)                                                                                | [Preview](https://bot.ziji.best/#/)                                                                                                 |
| <img width="1310" height="945" alt="image" src="https://github.com/user-attachments/assets/fb28bae0-c0a6-497c-8be8-732cb6881448" /> | <img width="1837" height="931" alt="image" src="https://github.com/user-attachments/assets/5840b123-6de2-48d0-91fa-e3ddbc720cf5" /> |

---

## 🚀 Installation

### 1. Create a Discord Application

1. Go to [discord.dev](https://discord.com/developers/applications) and create a new application.
2. Navigate to **Installation** → enable all **Installation Contexts**:
   - Default Install Settings:
     - User Install → enable **applications.commands**
     - Guild Install → enable **applications.commands** and **bot**, Permissions optional
   - link add bot at **Install Link** → https://discord.com/oauth2/authorize?client_id=1501197759754272928

3. Navigate to **Bot** → enable all **Privileged Gateway Intents**:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

4. Reset your bot token and save it for the next step.

### 2. Clone & Install

```bash
git clone https://github.com/ZiProject/Ziji-bot-discord.git .
npm install --force
```

### 3. Configure Environment

Rename `.env.example` → `.env` and fill in your values:

```env
TOKEN  = "Your Bot Token"       # required
MONGO  = "mongodb+srv://user:pass@cluster.mongodb.net/ziji?retryWrites=true&w=majority&appName=ziji" # optional, include database name; appName is fallback
# ...
```

Rename `config.js.example` → `config.js`:

```js
module.exports = {
	deploy: true,
	defaultCooldownDuration: 5000,
	ImageSearch: true,
	// ...
};
```

### 4. Start the Bot

```bash
node .          # standard
npm run start   # via npm
npm run dev     # development (nodemon)
```

### 5. Run tests

```bash
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

<a href="https://github.com/ZiProject/Ziji-bot-discord/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ZiProject/Ziji-bot-discord" />
</a>

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) for details.

---

## 📬 Contact

- 🐙 GitHub: [ZiProject/Ziji-bot-discord](https://github.com/ZiProject/Ziji-bot-discord)
- 💬 Support Server: [discord.gg/wbhBExpMNj](https://discord.gg/wbhBExpMNj)
- 🎮 Bot Playground: [discord.gg/32GkbyXtbA](https://discord.gg/32GkbyXtbA) _(get the bot icon here)_
