const { GoogleGenerativeAI } = require("@google/generative-ai");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const client = useHooks.get("client");

const promptBuilder = async ({ content, user, lang, DataBase }) => {
	const { promptHistory, CurrentAI, CurrentUser } = (await DataBase.ZiUser.findOne({ userID: user?.id })) || {};

	const lowerContent = content?.toLowerCase()?.trim();
	const language = lang?.local_names || "vi_VN";

	const old_Prompt = `${
		promptHistory ?? `You are a Discord bot named: ${client.user.username} Supports slash commands `
	}\n${user?.username}: ${CurrentUser} \n${client.user.username}: ${CurrentAI}`.slice(-13000);

	const userPrompt = lowerContent ? `${user?.username} có câu hỏi: ${lowerContent}` : "How can I assist you today?";

	const Prompt =
		language === "vi_VN" ?
			`Context:\n${old_Prompt}\nPrompt: ${userPrompt}, Hãy trả lời bằng tiếng Việt.`
		:	`Context:\n${old_Prompt}\nPrompt: ${userPrompt}, Please respond in ${language}.`;
	//16384 token

	return { Prompt, old_Prompt };
};

module.exports.execute = async () => {
	useHooks.get("logger")?.debug?.("Starting initAI...");
	try {
		if (!config?.DevConfig?.ai || !process.env?.GEMINI_API_KEY?.length) return;

		const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
		const DataBase = useHooks.get("db");

		useHooks.set("ai", {
			client,
			genAI,
			run: async (prompt, user, lang) => {
				const generationConfig = {
					stopSequences: ["red"],
					temperature: 0.9,
					topP: 0.1,
					topK: 16,
				};
				const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });
				const { Prompt, old_Prompt } = await promptBuilder({ content: prompt, user, lang, DataBase });
				useHooks.get("logger")?.info?.(`Prompt:`, Prompt);
				useHooks.get("logger")?.info?.(`Old Prompt:`, old_Prompt);
				const result = await model.generateContent(Prompt, {});
				const text = result?.response?.text();

				if (!text) return "Lỗi khi gọi AI";
				if (!user) return text;

				await DataBase.ZiUser.updateOne(
					{ userID: user?.id },
					{
						$set: {
							promptHistory: old_Prompt,
							CurrentAI: text,
							CurrentUser: prompt,
						},
					},
					{ upsert: true },
				);

				return text;
			},
		});

		useHooks.get("logger")?.info?.(`Successfully loaded Ai model.`);
	} catch (error) {
		useHooks.get("logger")?.error?.(`Lỗi khi tải Ai model:`, error);
	}
};

module.exports.data = {
	name: "initAI",
	type: "extension",
	enable: true,
};
