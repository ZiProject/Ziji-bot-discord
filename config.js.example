module.exports = {
	/**
	 * Prefix mặc định của bot
	 * Default bot prefix
	 */
	prefix: "z!",

	/**
	 * Cho phép deploy command bot
	 * Allow bot command deployment
	 */
	deploy: true,

	/**
	 * Thời gian chờ mặc định giữa các lệnh (tính bằng mili giây)
	 * Default cooldown duration between commands (in milliseconds)
	 */
	defaultCooldownDuration: 5_000,

	/**
	 * Màu mặt định (hex , Random)
	 * color (hex , Random)
	 */
	defaultColor: "Random",

	/**
	 * Bật tính năng tìm kiếm hình ảnh 'true', 'false' nên tắt khi chạy trên server vì khá tốn tài nguyên
	 * Enable image search feature 'true', 'false'. Should be turned off when running on server as it's resource-intensive
	 */
	ImageSearch: true,

	/**
	 * Cấu hình mặc định của bot
	 * Default bot configuration
	 */
	botConfig: {
		
		/**
		 * Tên hoạt động của bot
		 * Bot's activity name
		 */
		ActivityName: "/help",

		/**
		 * Loại hoạt động của bot
		 * Bot's activity type (PLAYING, WATCHING, LISTENING, STREAMING)
		 */
		ActivityType: "PLAYING",

		/**
		 * Trạng thái mặc định của bot 'online', 'idle', 'dnd', 'invisible'
		 * Default bot status: 'online', 'idle', 'dnd', 'invisible'
		 */
		Status: "idle",

		/**
		 * ID của channel bot gửi lỗi
		 * Bot's error log channel ID
		 */
		ErrorLog: "",

		/**
		 * ID của channel feedback
		 * Bot's feedback channel ID
		 */
		FeedBack: "",

		/**
		 * ID của server hỗ trợ
		 * Support server ID
		 */
		SupportServer: "https://discord.gg/bkBejRNcR3",

		/**
		 * Link mời bot
		 * Bot's invite link
		 */
		InviteBot: "https://discord.com/oauth2/authorize?client_id=1005716197259612193",

		/**
		 * Link ảnh banner
		 * Banner image link
		 */
		Banner: "https://media.discordapp.net/attachments/1064851388221358153/1209448467077005332/image.png",

		/**
		 * Link ảnh Background - Không sử dụng discordapp cdn
		 * Background image link - Do not use discordapp cdn
		 * L
		 */
		rankBackground: "https://i.imgur.com/sVzFJ8W.jpeg",
	},

	/**
	 * Cấu hình mặc định của player
	 * Default player configuration
	 */
	PlayerConfig: {
		
		/**
		 * Mặc định tắt nghe của bot
		 * Default: bot doesn't listen (deaf mode)
		 */
		selfDeaf: true,

		/**
		 * Mặc định volume của bot (0-100) (auto)
		 * Default bot volume (0-100) (auto)
		 */
		volume: "auto",

		/**
		 * Mặc định bot sẽ rời khi không còn ai nghe
		 * Default: bot leaves when no one is listening
		 */
		leaveOnEmpty: true,

		/**
		 * Thời gian chờ bot sẽ rời khi không có người trong voice (ms)
		 * Cooldown before bot leaves when no one is listening (ms)
		 */
		leaveOnEmptyCooldown: 5_000,

		/**
		 * Mặc định bot sẽ rời khi hết bài hát
		 * Default: bot leaves when the song ends
		 */
		leaveOnEnd: true,

		/**
		 * Thời gian chờ bot sẽ rời khi hết bài hát (ms)
		 * Cooldown before bot leaves after song ends (ms)
		 */
		leaveOnEndCooldown: 50_0000,

		/**
		 * Đổi trạng thái của kênh thoại thành tên bài hát (true | false)
		 * Change voice channel status to song title (true | false)
		 */
		changeStatus: true,
	},


	/**
	 * Cấu hình mặc định của web app
	 * Default web app configuration
	 */
	webAppConfig: {
		/**
		 * Tùy chọn tắt, mở
		 * Toggle on/off
		 */
		enabled: false,
		/**
		 * Link điều khiển nhạc
		 * Music controller link
		 */
		musicControllerUrl: 'https://garret-bot-web.vercel.app',
		/**
		 * Link trạng thái bot
		 * Bot status page
		 */
		statusUrl: 'https://garretapp.betteruptime.com/',
		/**
		 * Link cài đặt người dùng cho bot
		 * User-setting for bot link
		 */
		dashboardUrl: 'https://zibot-dashboard.vercel.app/'
	},

	/**
	 * Ngôn ngữ mặc định của bot (vi, en, ...)
	 * Default bot language (vi, en, ...)
	 */
	DeafultLang: "vi",

	/**
	 * Danh sách ID của chủ sở hữu bot (người dùng có thể thực hiện lệnh owner) ["ID admin", "ID admin", ...]
	 * List of bot owner IDs (users who can execute owner commands) ["admin ID", "admin ID", ...]
	 */
	OwnerID: [],

	/**
	 * Danh sách ID của các server dành cho nhà phát triển ["ID server", "ID server", ...] or []
	 *  List of server IDs for developers ["server ID", "server ID", ...] or []
	 */
	DevGuild: [],

	/**
	 * Danh sách các lệnh cần tắt ["Play / Add music", "giveaways", ...]
	 * List of commands to disable ["command name", "command name", ...]
	 */
	disabledCommands: [],

	DevConfig: {
		/** ============ DEBUG ============ */
		//discordjs debug
		DJS_DEBUG: false,
		//player debug
		Player_DEBUG: false,

		//voiceExtension events debug
		voiceExt_DEBUG: false,

		/** ============ Else ============ */
		//enable Giveaway
		Giveaway: true,
		//enable AutoResponder
		AutoResponder: true,
		//enable welcomer
		welcomer: true,
		//enable AI
		ai: true,
		/** ============ Else ============ */
		//enable logger (info | debug | warn | error | leave blank to enable all type)
		logger: "info",
	},
};
