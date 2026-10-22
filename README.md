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

<img align="right" width="147"  style="background: transparent;" height="38" alt="Ziplayer" src="https://github.com/user-attachments/assets/8f768b49-d276-48a6-a5c5-ef7f6f03f882" />

### 🎵 Music Player

Full-featured music playback with an interactive player UI v2, queue management, search, and more. Multi bot support on one
player/per voice channel. Image search track support

The web music player can switch between the existing Discord voice playback and direct browser playback using ZiPlayer's
authenticated Opus web-audio stream.

The authenticated stream API supports per-user playback at `POST /api/stream/play`, live state updates at `GET /api/stream/state`
(Server-Sent Events), and playback controls at `POST /api/stream/control`. Browser clients can also receive the active Opus stream
over `/ws/stream` after authenticating with their user JWT.

📺 YouTube Review: Check out Zibot V10 in action — explore the music player, web interface, and Discord integration.
<p align="center">
  <a href="https://www.youtube.com/watch?v=858Eq25HpXg">
    <img src="https://img.youtube.com/vi/858Eq25HpXg/maxresdefault.jpg" alt="Zibot V10 — Music Player Showcase on YouTube" width="800"/>
  </a>
  <br/>
  <strong>▶️ Watch the Zibot V10 Music Player Showcase</strong>
</p>

<table><tr>
<td width="50%">	
Player
</td>
<td width="50%">	
Search
</td>
</tr>
<tr>
<td width="50%"><img width="985" height="916" alt="image" src="https://github.com/user-attachments/assets/60611cbb-08e1-4cf9-9fab-00805384d6e3" />
</td>
<td width="50%">	
	<img width="1130" height="697" alt="Search" src="https://github.com/user-attachments/assets/1eb6ff2c-3303-43c8-a637-f0855f25062a" />
<img width="927" height="318" alt="image" src="https://github.com/user-attachments/assets/4dc8d4a9-d4db-4982-8fdd-a45ca4f56d8c" />

</td>
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

<img width="930" height="280" alt="welcome" src="https://github.com/user-attachments/assets/2b3b4c4c-0c73-4e24-a831-7f004452686e" />

Welcome and goodbye GIFs are generated through [Image Studio](https://image-studio-green.vercel.app/animation). To use a custom
animation, export its JSON payload from the editor and upload it with the `animation` or `byeanimation` option in
`/welcomer setup`. Payloads can use `{userAVTurl}`, `{userName}`, and `{guildName}` placeholders.

<table>
<tr>
<td width="50%">
Image create
</td>
<td width="50%">
Easy to edit
</td>
</tr>
<tr>
<td width="50%">
<img width="950" height="260" alt="image" src="https://github.com/user-attachments/assets/93f6e112-c9a6-4388-9487-d2f7e54ab7fc" />
<img width="950" height="260" alt="image" src="https://github.com/user-attachments/assets/0154a8a5-641a-42f3-b22f-dcc7b33284e4" />
<img width="950" height="260" alt="image" src="https://github.com/user-attachments/assets/001e58cf-5c2a-48bf-b570-ddf82eee09da" />
<img width="1000" height="500" alt="image" src="https://github.com/user-attachments/assets/fdf82c9a-3566-41d8-a07f-553e41563ff5" />

</td>
<td width="50%">
<img width="1039" height="813" alt="image" src="https://github.com/user-attachments/assets/82994e0c-d6d0-4e49-8ae3-d20fe2bf0fa5" />
<img width="1000" height="500" alt="image" src="https://github.com/user-attachments/assets/bf6f5480-3178-4220-8e6b-088deacdcfee" />

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

### 3. Start the Config Editor

Run the standalone local configuration editor:

```bash
node . --config
```

Open [http://localhost:2003/config](http://localhost:2003/config) (or replace `2003` with your `SERVER_PORT`). This mode does not
start normal bot services or log in automatically. In the **Environment (.env)** editor, enter your `TOKEN`, then choose **Save &
test login**. The page reports login success or the Discord error; after success, the client is logged in and the page can use
Discord data for user, guild, and channel lookups. Use **Save .env** to save environment settings without logging in.

The editor also lets you change and save `config.js`. Saved `.env` values are read on the next process start, so restart the bot
after changing other environment settings

For regular bot runs, the configuration page is also available at [http://localhost:2003/config](http://localhost:2003/config) (or
the port set by `SERVER_PORT`). It is restricted to localhost.

<table>
<tr>
<td width="50%">
	<img width="1081" height="938" alt="image" src="https://github.com/user-attachments/assets/3cb54693-e654-4843-bdd3-510aca40087c" />
</td>
<td width="50%">	
	<img width="1065" height="760" alt="image" src="https://github.com/user-attachments/assets/40442067-79b4-4875-8edf-bee807e4884c" />
	<img width="1048" height="432" alt="image" src="https://github.com/user-attachments/assets/093b6bac-b57c-46b5-8818-56d12e42a18f" />
</td>
</tr>
</table>

### 4. Start the Bot

```bash
node .          # standard
npm run start   # via npm
npm run dev     # development
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
