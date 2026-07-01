const { GoogleGenerativeAI } = require("@google/generative-ai");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const client = useHooks.get("client");

/**
 * Hàm lấy danh sách Slash Commands hiện có của Bot
 */
const getCommandsList = async () => {
	try {
		const commands = await client.application.commands.fetch();

		if (!commands || commands.size === 0) return "No commands available.";

		return commands.map((cmd) => `/${cmd.name}: ${cmd.description || "Không có mô tả"}`).join("\n");
	} catch (err) {
		return "No commands available.";
	}
};

const promptBuilder = async ({ content, user, lang, DataBase }) => {
	const userData = (await DataBase.ZiUser.findOne({ userID: user?.id })) || {};
	const { promptHistory = "", CurrentAI = "", CurrentUser = "" } = userData;

	const lowerContent = content?.toLowerCase()?.trim();
	const language = lang?.local_names || "Vietnamese";
	const commandsList = await getCommandsList();

	// Hệ thống Instruction (System Prompt) - Nơi quy định "tính cách" và "khả năng"
	const systemPrompt = `
        You are a Discord bot named: ${client.user.username}.
        Available Slash Commands:
        ${commandsList}
        
        Guidelines:
        1. Respond in ${language}.
        2. Use a friendly, helpful, and slightly witty tone.
        3. Use Discord Markdown (bold, tables, lists) for clarity.
        4. You have access to Google Search for real-time information.
    `.trim();

	// Lịch sử hội thoại (Context) dạng có cấu trúc
	let history = [];
	if (promptHistory) {
		try {
			history = JSON.parse(promptHistory);
		} catch {
			// Fallback nếu lịch sử trước đó dạng chuỗi phẳng
			if (CurrentUser && CurrentAI) {
				history = [
					{ role: "user", parts: [{ text: CurrentUser }] },
					{ role: "model", parts: [{ text: CurrentAI }] },
				];
			}
		}
	}

	return { finalPrompt: lowerContent || "hello", systemPrompt, history };
};

module.exports.execute = async () => {
	useHooks.get("logger")?.debug?.("Starting initAI with Google Search...");
	try {
		if (!config?.DevConfig?.ai || !process.env?.GEMINI_API_KEY) return;

		const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
		const DataBase = useHooks.get("db");

		useHooks.set("ai", {
			client,
			genAI,
			run: async (prompt, user, lang) => {
				const { finalPrompt, systemPrompt, history } = await promptBuilder({ content: prompt, user, lang, DataBase });

				const model = genAI.getGenerativeModel({
					model: "gemini-2.5-flash", // Hoặc "gemini-1.5-pro"
					// Kích hoạt tính năng Google Search
					tools: [{ googleSearch: {} }],
					systemInstruction: systemPrompt,
				});

				const generationConfig = {
					temperature: 0.7, // Giảm xuống một chút để câu trả lời ổn định hơn
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 2048,
				};

				// Khởi tạo phiên chat với lịch sử
				const chat = model.startChat({
					history,
					generationConfig,
				});

				const result = await chat.sendMessage(finalPrompt);
				const text = result?.response?.text();
				if (!text) return "⚠️ Có lỗi xảy ra khi kết nối với trí tuệ nhân tạo.";

				if (user) {
					const updatedHistory = await chat.getHistory();
					const historyToSave = updatedHistory.slice(-20); // Giới hạn 20 tin nhắn gần nhất (~10 lượt)

					await DataBase.ZiUser.updateOne(
						{ userID: user?.id },
						{
							$set: {
								promptHistory: JSON.stringify(historyToSave),
								CurrentAI: text,
								CurrentUser: prompt,
							},
						},
						{ upsert: true },
					);
				}

				return text;
			},
		});

		useHooks.get("logger")?.info?.(`Successfully loaded Gemini AI with Search Grounding.`);
		//console.log(useHooks.get("ai"));
	} catch (error) {
		useHooks.get("logger")?.error?.(`Lỗi khi tải Ai model:`, error);
	}
};

module.exports.data = {
	name: "initAI",
	type: "extension",
	enable: true,
};
