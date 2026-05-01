<div align="center">
  <img src="https://raw.githubusercontent.com/zijipia/zijipia/main/Assets/ZijiAvt.gif" width="80" alt="Ziji Bot"/>

  <h1>Zibot V10</h1>
  <p>A feature-rich Discord bot built with <a href="https://discord.js.org/">discord.js</a> and <a href="https://player.ziji.world">ziplayer</a></p>

  <a href="https://discord.com/oauth2/authorize?client_id=1005716197259612193">
    <img src="https://img.shields.io/badge/Add%20to%20Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Add Ziji Bot"/>
  </a>
  <a href="https://discord.gg/zaskhD7PTW">
    <img src="https://img.shields.io/discord/1007597270704869387?style=for-the-badge&color=7289DA&logo=discord&logoColor=white&label=Support" alt="Support Server"/>
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"/>
  </a>
</div>

---

## ✨ Features

### 🎵 Music Player

Full-featured music playback with an interactive player UI, queue management, search, and more.

<table>
<tr>
<td width="50%"><img alt="Player" src="https://raw.githubusercontent.com/zijipia/zijipia/Ziji-Discord-Bot-Image/Assets/Player.png"/></td>
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

Ban · Kick · Timeout · Purge · Auto-Responder · Giveaways · Ticket system · Welcomer

### 🌐 Web Interface

| Web Control                                                                                                  | Web Music Player                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Ziji-bot-web](https://github.com/zijipia/Zibot-Web)                                                        | [Preview](https://bot.ziji.best/#/)                                                      |
| <img width="1310" height="945" alt="image" src="https://github.com/user-attachments/assets/fb28bae0-c0a6-497c-8be8-732cb6881448" /> | <img width="1837" height="931" alt="image" src="https://github.com/user-attachments/assets/5840b123-6de2-48d0-91fa-e3ddbc720cf5" /> |

---

## 🚀 Installation

### 1. Create a Discord Application

1. Go to [discord.dev](https://discord.com/developers/applications) and create a new application.
2. Navigate to **Installation** → enable all **Installation Contexts**:
   - Default Install Settings:
     - User Install → enable **applications.commands**
     - Guild Install → enable **applications.commands** and **bot**, Permissions optional
   - link add bot at **Install Link** → https://discord.com/oauth2/authorize?client_id=1005716197259612193

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
MONGO  = "Your MongoDB URI"     # optional
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

---


## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) for details.

---

## 📬 Contact

- 🐙 GitHub: [ZiProject/Ziji-bot-discord](https://github.com/ZiProject/Ziji-bot-discord)
- 💬 Support Server: [discord.gg/GQyJkZDtdX](https://discord.gg/GQyJkZDtdX)
- 🎮 Bot Playground: [discord.gg/32GkbyXtbA](https://discord.gg/32GkbyXtbA) _(get the bot icon here)_
