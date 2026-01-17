<div align="center">
<a  href="https://discord.com/oauth2/authorize?client_id=1005716197259612193"><img  src="https://img.shields.io/badge/ADD_Bot-Ziji_Bot?style=for-the-badge&label=Ziji%20Bot&color=%237289DA"  alt="Add Ziji bot"></a> <a  href="https://discord.gg/zaskhD7PTW"><img  src="https://img.shields.io/discord/1007597270704869387?style=for-the-badge&color=%237289DA"  alt="Ziji Discord support server"></a>
</div>

# [<img src="https://raw.githubusercontent.com/zijipia/zijipia/main/Assets/ZijiAvt.gif" width="15"/>](./) Zibot V10

Zibot is a Discord bot developed by [zijipia](https://github.com/zijipia) to enhance your Discord server with various
functionalities, using [discord.js](https://discord.js.org/) and [ziplayer](https://player.ziji.world)

# Join [Zi bot Playground:](https://discord.gg/32GkbyXtbA) to get icon of bot.

## Features

- **Event Handling**: Respond to various Discord events.

- **Music Player**:

<table>
<tr>
<td width="50%">
<img  alt="Player"  src="https://raw.githubusercontent.com/zijipia/zijipia/Ziji-Discord-Bot-Image/Assets/Player.png"  /></td>
<td width="50%">
<img  alt="Search"  src="https://github.com/zijipia/zijipia/blob/Ziji-Discord-Bot-Image/Assets/search.png"  />
</td>
</tr>
</table>

## Web:

| Web Control                                                                                                                          | Web Music                                                                                                                            |
| :----------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| [Ziji-bot-web](https://github.com/zijipia/Ziji-bot-web)                                                                              | [Music-Player ](https://github.com/zijipia/Music-Player)                                                                             |
| <img width="1909" height="1115" alt="image" src="https://github.com/user-attachments/assets/b2ee308e-2f46-4c20-86a6-c7f95108a86b" /> | <img width="1909" height="1115" alt="image" src="https://github.com/user-attachments/assets/4b7b4988-c61b-4a1b-b424-25a0d103c639" /> |

- **Lyrics**: Using Lrclib
  - synced Lyrics

  - plain Lyrics

- **Voice command**:
  - Voice control for music: play, pause, skip, adjust volume, and more.

  - Multi-language support: Recognizes and responds in Vietnamese/ English.

  - Integrated AI assistant: Interact with AI assistant using voice in voice channels.

- **minigame**:
  - 2048
  - blackjack
  - coinflip
  - slots
  - snake
  - ...

# Installation

## Setup bot

Go to [discord.dev](https://discord.dev/) create your applications

![image](https://github.com/user-attachments/assets/6f846a76-eb0c-4bdd-bda2-b23e0390f782) ↗
![image](https://github.com/user-attachments/assets/c1498103-e22e-43d2-b4d0-bf19de872a5d)

Enable Privileged Gateway Intents: ![image](https://github.com/user-attachments/assets/e4212b5d-6932-4160-831e-e30b212db3da) ↴

![image](https://github.com/user-attachments/assets/17cf92bf-76d4-43e0-8cb0-ff901f9e8f78)

Reset token and add this to setp 3 below.

## Setup project

1. Clone the repository or download project:

```bash

git  clone  https://github.com/zijipia/Zibot.git

cd  Zibot

```

2. Install dependencies:

```bash

npm  install

```

3. Set up your environment variables (e.g., TOKEN, MONGO), config:

- Rename file .env.example to .env:

```bash

TOKEN  =  "Your Bot Token"  # required

MONGO  =  "Your Bot Mongo URI"  # optional

...

```

- Rename file config.js.example to config.js

```js

module.exports  =  {



deploy:  true,



defaultCooldownDuration:  5000,



ImageSearch:  true,



}

...

```

4. Start the bot:

```bash

node  .

#or

npm  run  start

#or for dev ( using nodemon)

npm  run  dev

```

## Using ngrok

1. Visit [ngrok's dashboard](https://dashboard.ngrok.com) and log in with your account or create it if you don't have.
2. Go to [Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) in the sidebar, copy the token and paste into
   `.env` -> `NGROK_AUTHTOKEN`
3. Go to [Domain](https://dashboard.ngrok.com/domains), generate a domain if you don't have and copy it
4. Copy the domain and paste it into `.env` -> `NGROK_DOMAIN` _(The domain is look like `something.ngrok-free.app`)_

> [!IMPORTANT] Don't create Edges or it won't work, you can delete it after creating, enable webapp in config!

<img  alt="ngrok"  src="https://files.catbox.moe/dqc3z6.png"  />

## Contributing

Contributions are welcome!

If you made some changes that you think should make it into the project, send a Pull Request on GitHub

## License

This project is licensed under the MIT License. See the [LICENSE](./blob/main/LICENSE) file for details.

## Contact

For more information, visit the [project page](https://github.com/zijipia/Ziji-bot-discord)

[Support sever](https://discord.gg/GQyJkZDtdX).
