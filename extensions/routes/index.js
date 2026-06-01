const { useHooks } = require("zihooks");
const simpleGit = require("simple-git");
const config = useHooks.get("config");
const path = require("path");

// Khởi tạo simple-git tại thư mục gốc của project
const git = simpleGit(path.join(__dirname, "../../")); // Điều chỉnh đường dẫn nếu cần

module.exports.data = {
	name: "routesIndex",
	description: "Index of all route modules",
	version: "1.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = async (client) => {
	const app = useHooks.get("server");
	const playerNetClient = useHooks.get("playerNetClient");

	app.get("/", async (req, res) => {
		// 1. Kiểm tra trạng thái client
		if (!client.isReady()) {
			return res.json({
				status: "NG",
				content: "API loading...!",
			});
		}

		// Dữ liệu base để dùng cho cả JSON và HTML
		const clientData = {
			status: "OK",
			content: "Welcome to API!",
			clientName: client?.user?.displayName || "HaKaZe Bot",
			clientId: client?.user?.id || "N/A",
			avatars: client?.user?.displayAvatarURL({ size: 1024 }) || "https://i.imgur.com/w39R973.png",
			inviteUrl: `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`,
			playerNetClient: playerNetClient.map((client) => ({
				clientId: client.user.id,
				clientName: client.user.displayName,
				avatars: client.user.displayAvatarURL({ size: 1024 }),
				inviteUrl: `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`,
			})),
		};

		// 2. Thu thập thông tin từ Repo bằng simple-git để hiển thị hoặc trả về
		let repoInfo = { branch: "main", latestCommit: "N/A", repoUrl: "#" };
		try {
			const status = await git.status();
			const log = await git.log({ maxCount: 1 });
			const remotes = await git.getRemotes(true);

			// Lấy URL repo từ remote "origin" (nếu có) và format lại từ git@ sang https nếu cần
			let url = remotes.find((r) => r.name === "origin")?.refs?.fetch || "#";
			if (url.startsWith("git@")) {
				url = url.replace(":", "/").replace("git@", "https://").replace(".git", "");
			}

			repoInfo = {
				branch: status.current,
				latestCommit: log.latest ? log.latest.hash.substring(0, 7) : "N/A",
				repoUrl: url,
			};
		} catch (err) {
			console.error("Git error:", err.message);
		}

		// 3. Check "User-Agent" hoặc "Accept" để phân biệt Browser và API Call (curl, postman,...)
		const userAgent = req.headers["user-agent"] || "";
		const acceptHeader = req.headers["accept"] || "";

		const isBrowser = userAgent.includes("Mozilla") && acceptHeader.includes("text/html");

		if (!isBrowser) {
			// Trả về JSON thuần túy như cũ nếu gọi qua curl
			return res.json({
				...clientData,
				repo: repoInfo,
			});
		}

		// 4. Render Giao diện Glassmorphic Anime UI cho Trình duyệt
		const htmlTemplate = `
		<!DOCTYPE html>
		<html lang="vi">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${clientData.clientName} - Dashboard</title>
			<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
			<style>
				:root {
					--bg-image: url(${config.botConfig.webBackground || config.botConfig.Banner}); /* Ảnh nền Your Name anime tương tự hình */
					--glass-bg: rgba(15, 18, 36, 0.65);
					--glass-border: rgba(255, 255, 255, 0.08);
					--accent-purple: #5865F2;
					--accent-green: #23a55a;
					--text-main: #f2f3f5;
					--text-muted: #949ba4;
				}

				* {
					box-sizing: border-box;
					margin: 0;
					padding: 0;
					font-family: 'Inter', sans-serif;
				}

				body {
					background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), var(--bg-image);
					background-size: cover;
					background-position: center;
					background-attachment: fixed;
					color: var(--text-main);
					min-height: 100vh;
					display: flex;
					justify-content: center;
					align-items: center;
					padding: 20px;
				}

				.container {
					width: 100%;
					max-width: 800px;
					background: rgba(10, 12, 22, 0.4);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					border: 1px solid var(--glass-border);
					border-radius: 24px;
					overflow: hidden;
					box-shadow: 0 20px 50px rgba(0,0,0,0.4);
				}

				/* Banner Profile */
				.banner-card {
					position: relative;
					background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,18,36,0.95) 100%), var(--bg-image);
					background-size: cover;
					background-position: center 30%;
					height: 220px;
					display: flex;
					align-items: flex-end;
					padding: 24px;
				}

				.profile-area {
					display: flex;
					align-items: center;
					gap: 20px;
					width: 100%;
				}

				.avatar {
					width: 90px;
					height: 90px;
					border-radius: 50%;
					border: 3px solid var(--accent-purple);
					box-shadow: 0 0 15px rgba(88, 101, 242, 0.5);
					object-fit: cover;
				}

				.profile-info h1 {
					font-size: 24px;
					font-weight: 700;
					letter-spacing: 0.5px;
				}

				.profile-info p {
					color: var(--text-muted);
					font-size: 14px;
					margin-top: 4px;
				}

				/* Buttons */
				.action-bar {
					background: rgba(15, 18, 36, 0.95);
					padding: 0 24px 24px 24px;
					display: flex;
					gap: 12px;
					flex-wrap: wrap;
				}

				.badge-status {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					background: rgba(35, 165, 90, 0.15);
					color: #57f287;
					padding: 10px 16px;
					border-radius: 12px;
					font-size: 13px;
					font-weight: 600;
					border: 1px solid rgba(35, 165, 90, 0.3);
				}

				.badge-status::before {
					content: '';
					width: 8px;
					height: 8px;
					background: var(--accent-green);
					border-radius: 50%;
					display: inline-block;
				}

				.btn {
					text-decoration: none;
					display: inline-flex;
					align-items: center;
					gap: 8px;
					padding: 10px 20px;
					border-radius: 12px;
					font-size: 14px;
					font-weight: 600;
					transition: all 0.2s ease;
					cursor: pointer;
				}

				.btn-primary {
					background: var(--accent-purple);
					color: white;
					border: none;
				}

				.btn-primary:hover {
					background: #4752c4;
					transform: translateY(-2px);
				}

				.btn-secondary {
					background: rgba(255, 255, 255, 0.06);
					color: var(--text-main);
					border: 1px solid var(--glass-border);
				}

				.btn-secondary:hover {
					background: rgba(255, 255, 255, 0.1);
					transform: translateY(-2px);
				}

				/* Main Features Grid */
				.main-content {
					background: rgba(15, 18, 36, 0.85);
					padding: 24px;
				}

				.section-title {
					font-size: 12px;
					text-transform: uppercase;
					letter-spacing: 1.5px;
					color: var(--text-muted);
					margin-bottom: 16px;
					font-weight: 700;
				}

				.features-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
					gap: 16px;
					margin-bottom: 28px;
				}

				.feature-card {
					background: rgba(255, 255, 255, 0.03);
					border: 1px solid var(--glass-border);
					border-radius: 16px;
					padding: 18px;
					transition: border 0.2s;
				}

				.feature-card:hover {
					border-color: rgba(88, 101, 242, 0.4);
				}

				.icon-wrapper {
					width: 36px;
					height: 36px;
					border-radius: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
					margin-bottom: 12px;
					font-size: 16px;
				}

				.f-1 { background: rgba(148, 108, 247, 0.15); color: #b58eff; }
				.f-2 { background: rgba(57, 215, 119, 0.15); color: #57f287; }
				.f-3 { background: rgba(255, 161, 33, 0.15); color: #ffb142; }
				.f-4 { background: rgba(0, 180, 216, 0.15); color: #00b4d8; }

				.feature-card h3 {
					font-size: 15px;
					font-weight: 600;
					margin-bottom: 6px;
				}

				.feature-card p {
					font-size: 12px;
					color: var(--text-muted);
					line-height: 1.4;
				}

				/* Command List (Lệnh chính) */
				.cmd-list {
					background: rgba(0, 0, 0, 0.2);
					border-radius: 16px;
					border: 1px solid var(--glass-border);
					padding: 8px;
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
					gap: 8px;
					margin-bottom: 28px;
				}

				.cmd-item {
					display: flex;
					align-items: center;
					padding: 10px 14px;
					border-radius: 10px;
					transition: background 0.2s;
				}

				.cmd-item:hover {
					background: rgba(255, 255, 255, 0.03);
				}

				.cmd-name {
					color: #9b98f2;
					font-weight: 600;
					font-size: 14px;
					width: 100px;
					font-family: 'Courier New', Courier, monospace;
				}

				.cmd-desc {
					color: var(--text-main);
					font-size: 13px;
				}

				/* Footer Sources */
				.sources-flex {
					display: flex;
					gap: 10px;
					flex-wrap: wrap;
				}

				.source-tag {
					background: rgba(255, 255, 255, 0.04);
					border: 1px solid var(--glass-border);
					padding: 8px 14px;
					border-radius: 20px;
					font-size: 12px;
					display: flex;
					align-items: center;
					gap: 6px;
					color: var(--text-muted);
					transition: all 0.2s;
				}

				.source-tag:hover {
					background: rgba(255, 255, 255, 0.08);
					color: var(--text-main);
				}
			</style>
		</head>
		<body>

			<div class="container">
				<div class="banner-card">
					<div class="profile-area">
						<img src="${clientData.avatars}" alt="Avatar" class="avatar">
						<div class="profile-info">
							<h1>${clientData.clientName}</h1>
							<p>Bot nhạc đa năng • ID: ${clientData.clientId}</p>
						</div>
					</div>
				</div>

				<div class="action-bar">
					<span class="badge-status">Đang hoạt động</span>
					<a href="${config.botConfig.InviteBot || `https://discord.com/oauth2/authorize?client_id=${client.user.id}`}" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Thêm vào Server</a>
					<a href="${repoInfo.repoUrl}" target="_blank" class="btn btn-secondary">
						<i class="fa-brands fa-git-alt"></i> Xem repo (${repoInfo.branch} @ ${repoInfo.latestCommit})
					</a>
				</div>

				<div class="main-content">
					<div class="section-title">Tính năng nổi bật</div>
					<div class="features-grid">
						<div class="feature-card">
							<div class="icon-wrapper f-1"><i class="fa-solid fa-music"></i></div>
							<h3>Đa nền tảng</h3>
							<p>YouTube, SoundCloud, Twitch, Vimeo và link trực tiếp.</p>
						</div>
						<div class="feature-card">
							<div class="icon-wrapper f-2"><i class="fa-solid fa-forward"></i></div>
							<h3>Autoplay</h3>
							<p>Tự động tìm và phát bài liên quan khi hết hàng đợi.</p>
						</div>
						<div class="feature-card">
							<div class="icon-wrapper f-3"><i class="fa-solid fa-list-ol"></i></div>
							<h3>Quản lý Queue</h3>
							<p>Shuffle, repeat, remove, xem tiến trình từng bài cực kì trực quan.</p>
						</div>
						<div class="feature-card">
							<div class="icon-wrapper f-4"><i class="fa-solid fa-server"></i></div>
							<h3>Hoạt động 24/7</h3>
							<p>Chạy liên tục trên VPS ổn định, không lo gián đoạn cuộc vui.</p>
						</div>
					</div>

					<div class="section-title">Lệnh chính</div>
					<div class="cmd-list">
						<div class="cmd-item"><div class="cmd-name">!play</div><div class="cmd-desc">Phát nhạc từ URL hoặc tên bài hát</div></div>
						<div class="cmd-item"><div class="cmd-name">!skip</div><div class="cmd-desc">Bỏ qua bài đang phát hiện tại</div></div>
						<div class="cmd-item"><div class="cmd-name">!queue</div><div class="cmd-desc">Xem danh sách hàng đợi hiện tại</div></div>
						<div class="cmd-item"><div class="cmd-name">!np</div><div class="cmd-desc">Xem bài đang phát + tiến trình thời gian</div></div>
						<div class="cmd-item"><div class="cmd-name">!autoplay</div><div class="cmd-desc">Bật/tắt tự động phát bài liên quan</div></div>
						<div class="cmd-item"><div class="cmd-name">!volume</div><div class="cmd-desc">Điều chỉnh âm lượng Bot (0 - 100)</div></div>
						<div class="cmd-item"><div class="cmd-name">!shuffle</div><div class="cmd-desc">Xáo trộn thứ tự các bài trong hàng đợi</div></div>
						<div class="cmd-item"><div class="cmd-name">!repeat</div><div class="cmd-desc">Lặp lại bài hiện tại hoặc cả queue</div></div>
					</div>

					<div class="section-title">Nguồn nhạc hỗ trợ</div>
					<div class="sources-flex">
						<div class="source-tag"><i class="fa-brands fa-youtube" style="color: #ff0000;"></i> YouTube</div>
						<div class="source-tag"><i class="fa-brands fa-soundcloud" style="color: #ff5500;"></i> SoundCloud</div>
						<div class="source-tag"><i class="fa-brands fa-bandcamp" style="color: #1da1f2;"></i> Bandcamp</div>
						<div class="source-tag"><i class="fa-brands fa-twitch" style="color: #9146ff;"></i> Twitch</div>
						<div class="source-tag"><i class="fa-brands fa-vimeo-v" style="color: #1ab7ea;"></i> Vimeo</div>
						<div class="source-tag"><i class="fa-solid fa-link"></i> Link trực tiếp</div>
					</div>
				</div>
			</div>

		</body>
		</html>
		`;

		res.send(htmlTemplate);
	});

	app.get("/api/health", (req, res) => {
		res.json({ status: "ok" });
	});

	return;
};
